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
        address treasury
    ) external initializer {
        require(
            _wSan != address(0) &&
            _idrx != address(0) &&
            _dex != address(0),
            "Invalid address"
        );

        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        wSanToken = IERC20Upgradeable(_wSan);
        idrxToken = IERC20Upgradeable(_idrx);
        santaraDex = IWrappedSantaraDEX(_dex);

        ethToIdrPrice = 50_000_000;
        lastPriceUpdate = block.timestamp;

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

        uint256 amountIDRX = msg.value * ethToIdrPrice;

        require(amountIDRX >= minIDRXOut, "Slippage too high");
        require(
            idrxToken.balanceOf(address(this)) >= amountIDRX,
            "Insufficient IDRX liquidity"
        );

        idrxToken.safeTransfer(msg.sender, amountIDRX);

        emit Swapped(msg.sender, address(0), msg.value, amountIDRX);
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

        uint256 amountIDRX = (amountWSAN * rate) / SCALE;

        require(amountIDRX >= minIDRXOut, "Slippage too high");
        require(
            idrxToken.balanceOf(address(this)) >= amountIDRX,
            "Insufficient IDRX liquidity"
        );

        wSanToken.safeTransferFrom(msg.sender, address(this), amountWSAN);
        idrxToken.safeTransfer(msg.sender, amountIDRX);

        emit Swapped(msg.sender, address(wSanToken), amountWSAN, amountIDRX);
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
    function rescueFunds(address token, uint256 amount)
        external
        onlyRole(TREASURY_ROLE)
    {
        if (token == address(0)) {
            payable(msg.sender).transfer(address(this).balance);
        } else {
            IERC20Upgradeable(token).safeTransfer(msg.sender, amount);
        }
    }

    receive() external payable {}

    // =========================
    // STORAGE GAP (UPGRADE SAFE)
    // =========================
    uint256[50] private __gap;
}