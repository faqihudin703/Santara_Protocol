// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

interface IBurnableERC20 {
    function burnFrom(address account, uint256 amount) external;
}

contract NXSRedemption is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public nxsToken;
    IERC20Upgradeable public usdcToken;
    
    uint256 public redeemRate;

    event Redeemed(address indexed user, uint256 nxsAmount, uint256 usdcAmount);
    event RateUpdated(uint256 newRate);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _nxs,
        address _usdc,
        uint256 _initialRate
    ) external initializer {
        require(_nxs != address(0) && _usdc != address(0), "Invalid address");
        require(_initialRate > 0, "Invalid rate");

        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        nxsToken = IERC20Upgradeable(_nxs);
        usdcToken = IERC20Upgradeable(_usdc);
        redeemRate = _initialRate;
    }

    // ====================================================
    // MAIN LOGIC
    // ====================================================

    function redeem(uint256 nxsAmount)
        external
        nonReentrant
        whenNotPaused
    {
        require(nxsAmount > 0, "Amount zero");

        // (NXS * rate) / 1e18 => USDC (6 decimals)
        uint256 usdcAmount = (nxsAmount * redeemRate) / 1e18;
        require(usdcAmount > 0, "Rate too low");

        require(
            usdcToken.balanceOf(address(this)) >= usdcAmount,
            "Insufficient USDC"
        );

        // 🔥 1. Burn NXS langsung dari user
        // User HARUS approve NXS ke contract ini
        IBurnableERC20(address(nxsToken)).burnFrom(msg.sender, nxsAmount);

        // 💵 2. Kirim USDC
        usdcToken.safeTransfer(msg.sender, usdcAmount);

        emit Redeemed(msg.sender, nxsAmount, usdcAmount);
    }

    // ====================================================
    // ADMIN
    // ====================================================

    function setRate(uint256 newRate) external onlyOwner {
        require(newRate > 0, "Invalid rate");
        redeemRate = newRate;
        emit RateUpdated(newRate);
    }

    function withdrawUSDC(uint256 amount) external onlyOwner {
        usdcToken.safeTransfer(msg.sender, amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ====================================================
    // STORAGE GAP (UPGRADE SAFE)
    // ====================================================
    uint256[45] private __gap;
}
