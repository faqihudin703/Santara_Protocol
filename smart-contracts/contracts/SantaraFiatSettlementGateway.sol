// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SantaraFiatSettlementGateway
 * @notice On-chain settlement simulation (bank-style)
 */
contract SantaraFiatSettlementGateway is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable idrxToken;

    // ================= RISK LIMITS =================
    uint256 public constant DAILY_LIMIT   = 5_000 * 1e18;
    uint256 public constant WEEKLY_LIMIT  = 35_000 * 1e18;
    uint256 public constant MONTHLY_LIMIT = 150_000 * 1e18;

    struct SettlementQuota {
        uint256 dailySettled;
        uint256 weeklySettled;
        uint256 monthlySettled;
        uint256 lastDailyReset;
        uint256 lastWeeklyReset;
        uint256 lastMonthlyReset;
    }

    mapping(address => SettlementQuota) public settlementQuotas;

    // ================= ANTI-REPLAY =================
    mapping(bytes32 => bool) public usedTransferIds;

    // ================= EVENTS =================
    event FiatPaymentSettled(
        address indexed payer,
        uint256 amount,
        bytes32 transferId,
        uint256 clientNonce,
        uint256 blockTimestamp
    );

    event TreasuryWithdrawn(address indexed to, uint256 amount);

    constructor(address _idrxToken) {
        require(_idrxToken != address(0), "Invalid token");
        idrxToken = IERC20(_idrxToken);
    }

    // ================= CORE SETTLEMENT =================
    function settleFiatPayment(
        uint256 amount,
        uint256 clientNonce
    ) external nonReentrant {
        require(amount > 0, "Invalid amount");

        // ===== AUTHORITATIVE TRANSFER ID =====
        bytes32 transferId = keccak256(
            abi.encodePacked(
                msg.sender,
                amount,
                clientNonce,
                block.timestamp
            )
        );

        require(!usedTransferIds[transferId], "Duplicate transfer");

        SettlementQuota storage quota = settlementQuotas[msg.sender];

        // ===== INIT RESET =====
        if (quota.lastDailyReset == 0) {
            quota.lastDailyReset = block.timestamp;
            quota.lastWeeklyReset = block.timestamp;
            quota.lastMonthlyReset = block.timestamp;
        }

        // ===== RESET LOGIC =====
        if (block.timestamp >= quota.lastDailyReset + 1 days) {
            quota.dailySettled = 0;
            quota.lastDailyReset = block.timestamp;
        }

        if (block.timestamp >= quota.lastWeeklyReset + 7 days) {
            quota.weeklySettled = 0;
            quota.lastWeeklyReset = block.timestamp;
        }

        if (block.timestamp >= quota.lastMonthlyReset + 30 days) {
            quota.monthlySettled = 0;
            quota.lastMonthlyReset = block.timestamp;
        }

        // ===== RISK LIMIT =====
        require(quota.dailySettled + amount <= DAILY_LIMIT, "Daily limit");
        require(quota.weeklySettled + amount <= WEEKLY_LIMIT, "Weekly limit");
        require(quota.monthlySettled + amount <= MONTHLY_LIMIT, "Monthly limit");

        // ===== LIQUIDITY =====
        require(
            idrxToken.balanceOf(address(this)) >= amount,
            "Insufficient liquidity"
        );

        // ===== STATE UPDATE =====
        usedTransferIds[transferId] = true;

        quota.dailySettled += amount;
        quota.weeklySettled += amount;
        quota.monthlySettled += amount;

        // ===== SETTLEMENT =====
        idrxToken.safeTransfer(msg.sender, amount);

        emit FiatPaymentSettled(
            msg.sender,
            amount,
            transferId,
            clientNonce,
            block.timestamp
        );
    }

    // ================= TREASURY =================
    function withdrawTreasury(address to, uint256 amount)
        external
        onlyOwner
    {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Zero amount");

        idrxToken.safeTransfer(to, amount);
        emit TreasuryWithdrawn(to, amount);
    }
}