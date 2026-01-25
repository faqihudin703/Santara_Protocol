// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

interface IWrappedSantaraDEX {
    function getReserves() external view returns (uint256 wSanReserve, uint256 ethReserve);
}

contract SantaraDirectSwap is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // =========================
    // ROLES
    // =========================
    bytes32 public constant ORACLE_ROLE    = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE    = keccak256("PAUSER_ROLE");
    bytes32 public constant TREASURY_ROLE  = keccak256("TREASURY_ROLE");

    // =========================
    // TOKENS & DEX
    // =========================
    IERC20Upgradeable public wSanToken;
    IERC20Upgradeable public idrxToken;
    IWrappedSantaraDEX public santaraDex;

    // =========================
    // ORACLE DATA
    // =========================
    uint256 public ethToIdrPrice;
    uint256 public lastPriceUpdate;

    uint256 public constant MIN_PRICE = 1_000_000;
    uint256 public constant MAX_PRICE = 1_000_000_000;
    uint256 public constant MAX_DELAY = 1 hours;

    uint256 private constant SCALE = 1e18;
    
    // =========================
    // FEE DATA
    // =========================
    uint256 public swapEthFeeBps;
    uint256 public swapWSanFeeBps;
    uint256 public collectedFees;

    // =========================
    // EVENTS
    // =========================
    event Swapped(
        address indexed user,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountIDRX
    );

    event PriceUpdated(
        uint256 oldPrice,
        uint256 newPrice,
        uint256 timestamp
    );
    
    event EthFeeUpdated(
        uint256 newFeeBps
    );
    
    event WSanFeeUpdated(
        uint256 newFeeBps
    );
    
    event FeesWithdrawn(
        address indexed to,
        uint256 amount
    );
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // =========================
    // INITIALIZER
    // =========================
    function initialize(
        address _wSan,
        address _idrx,
        address _dex,
        address admin,
        address oracle,
        address treasury,
        uint256 _ethFeeBps,
        uint256 _wSanFeeBps
    ) external initializer {
        require(
            _wSan != address(0) &&
            _idrx != address(0) &&
            _dex != address(0),
            "Invalid address"
        );
        
        require(
            _ethFeeBps <= 1000 && 
            _wSanFeeBps <= 1000, 
            "Fee too high"
        );

        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        wSanToken = IERC20Upgradeable(_wSan);
        idrxToken = IERC20Upgradeable(_idrx);
        santaraDex = IWrappedSantaraDEX(_dex);

        ethToIdrPrice = 50_000_000;
        lastPriceUpdate = block.timestamp;
        
        swapEthFeeBps = _ethFeeBps;
        swapWSanFeeBps = _wSanFeeBps;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, oracle);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(TREASURY_ROLE, treasury);
    }

    // =========================
    // INTERNAL ORACLE CHECK
    // =========================
    function _checkOracle() internal view {
        require(
            block.timestamp - lastPriceUpdate <= MAX_DELAY,
            "Oracle price stale"
        );
    }
    
    function _applyFee(uint256 amount, uint256 feeBps) 
        internal 
        pure 
        returns (uint256 net, uint256 fee) 
    {
        if (feeBps == 0) return (amount, 0);
        fee = (amount * feeBps) / 10_000;
        net = amount - fee;
    }

    // =========================
    // SWAP ETH → IDRX
    // =========================
    function swapEthForIDRX(uint256 minIDRXOut)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        require(msg.value > 0, "No ETH sent");
        _checkOracle();

        uint256 grossIDRX = msg.value * ethToIdrPrice;
        
        (uint256 netIDRX, uint256 fee) = _applyFee(grossIDRX, swapEthFeeBps);

        require(netIDRX >= minIDRXOut, "Slippage too high");
        require(
            idrxToken.balanceOf(address(this)) >= grossIDRX,
            "Insufficient IDRX liquidity"
        );
        
        if (fee > 0) collectedFees += fee;

        idrxToken.safeTransfer(msg.sender, netIDRX);

        emit Swapped(msg.sender, address(0), msg.value, netIDRX);
    }

    // =========================
    // wSAN RATE
    // =========================
    function getWSanRate() public view returns (uint256) {
        (uint256 wSanRes, uint256 ethRes) = santaraDex.getReserves();
        if (wSanRes == 0 || ethRes == 0) return 0;

        uint256 wSanPriceInEth = (ethRes * SCALE) / wSanRes;
        return wSanPriceInEth * ethToIdrPrice;
    }

    // =========================
    // SWAP wSAN → IDRX
    // =========================
    function swapWSANForIDRX(uint256 amountWSAN, uint256 minIDRXOut)
        external
        nonReentrant
        whenNotPaused
    {
        require(amountWSAN > 0, "Zero amount");
        _checkOracle();

        uint256 rate = getWSanRate();
        require(rate > 0, "Invalid rate");

        uint256 grossIDRX = (amountWSAN * rate) / SCALE;
        
        (uint256 netIDRX, uint256 fee) = _applyFee(grossIDRX, swapWSanFeeBps);

        require(netIDRX >= minIDRXOut, "Slippage too high");
        require(
            idrxToken.balanceOf(address(this)) >= grossIDRX,
            "Insufficient IDRX liquidity"
        );

        wSanToken.safeTransferFrom(msg.sender, address(this), amountWSAN);
        
        if (fee > 0) collectedFees += fee;
        
        idrxToken.safeTransfer(msg.sender, netIDRX);

        emit Swapped(msg.sender, address(wSanToken), amountWSAN, netIDRX);
    }

    // =========================
    // ORACLE UPDATE
    // =========================
    function updateEthToIdrPrice(uint256 newPrice)
        external
        onlyRole(ORACLE_ROLE)
    {
        require(
            newPrice >= MIN_PRICE && newPrice <= MAX_PRICE,
            "Price out of range"
        );

        uint256 old = ethToIdrPrice;
        ethToIdrPrice = newPrice;
        lastPriceUpdate = block.timestamp;

        emit PriceUpdated(old, newPrice, block.timestamp);
    }
    
    // =========================
    // FEES UPDATE
    // =========================
    function updateSwapEthFee(uint256 newFeeBps) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newFeeBps <= 1000, "Fee max 10%");
        swapEthFeeBps = newFeeBps;
        emit EthFeeUpdated(newFeeBps);
    }
    
    function updateSwapWSanFee(uint256 newFeeBps) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newFeeBps <= 1000, "Fee max 10%");
        swapWSanFeeBps = newFeeBps;
        emit WSanFeeUpdated(newFeeBps);
    }

    // =========================
    // PAUSE
    // =========================
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // =========================
    // TREASURY
    // =========================
    function withdrawCollectedFees(address to, uint256 amount)
        external
        onlyRole(TREASURY_ROLE)
    {
        require(amount <= collectedFees, "Exceeds collected fees");
        
        collectedFees -= amount;
        
        idrxToken.safeTransfer(to, amount);
        
        emit FeesWithdrawn(to, amount);
    }
    
    function rescueFunds(address token, uint256 amount)
        external
        onlyRole(TREASURY_ROLE)
    {
        if (token == address(0)) {
            payable(msg.sender).transfer(address(this).balance);
        } else {
            if (token == address(idrxToken)) {
                uint256 currentBalance = idrxToken.balanceOf(address(this));
                require(currentBalance >= amount, "Insufficient balance");
                require(currentBalance - amount >= collectedFees, "Cannot withdraw Fee Reserves via rescueFunds");
            }
            IERC20Upgradeable(token).safeTransfer(msg.sender, amount);
        }
    }

    receive() external payable {}

    // =========================
    // STORAGE GAP (UPGRADE SAFE)
    // =========================
    uint256[50] private __gap;
}