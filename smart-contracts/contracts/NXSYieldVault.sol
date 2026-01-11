// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract NXSYieldVault is
    Initializable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // ================= ROLES =================
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    // ================= TOKENS =================
    IERC20Upgradeable public stakingToken; // IDRX
    IERC20Upgradeable public rewardsToken; // NXS

    // ================= EPOCH CONFIG =================
    uint256 public epochDuration;
    uint256 public epochReward;
    uint256 public lastEpochTime;

    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    // ================= EVENTS =================
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event EpochRewardUpdated(uint256 newReward);
    event EpochDurationUpdated(uint256 newDuration);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ================= INITIALIZE =================
    function initialize(address _stakingToken, address _rewardsToken) external initializer {
        require(_stakingToken != address(0) && _rewardsToken != address(0), "Invalid token");

        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();

        stakingToken = IERC20Upgradeable(_stakingToken);
        rewardsToken = IERC20Upgradeable(_rewardsToken);

        // ===== REALISTIC DEFAULT =====
        epochDuration = 1 days;
        epochReward = 5_000 * 1e18;
        lastEpochTime = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
    }

    // ================= MODIFIER =================
    modifier updateReward(address account) {
        _updateEpoch();

        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ================= INTERNAL =================
    function _updateEpoch() internal {
        if (_totalSupply == 0) {
            lastEpochTime = block.timestamp;
            return;
        }

        uint256 elapsed = block.timestamp - lastEpochTime;
        uint256 epochs = elapsed / epochDuration;

        if (epochs > 0) {
            uint256 reward = epochs * epochReward;
            rewardPerTokenStored += (reward * 1e18) / _totalSupply;
            lastEpochTime += epochs * epochDuration;
        }
    }

    // ================= VIEW =================
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function earned(address account) public view returns (uint256) {
        uint256 rpt = rewardPerTokenStored;

        if (_totalSupply > 0) {
            uint256 elapsed = block.timestamp - lastEpochTime;
            uint256 epochs = elapsed / epochDuration;
            if (epochs > 0) {
                uint256 reward = epochs * epochReward;
                rpt += (reward * 1e18) / _totalSupply;
            }
        }

        return
            (_balances[account] * (rpt - userRewardPerTokenPaid[account])) /
            1e18 +
            rewards[account];
    }

    // ================= USER =================
    function stake(uint256 amount)
        external
        nonReentrant
        whenNotPaused
        updateReward(msg.sender)
    {
        require(amount > 0, "Stake zero");

        _totalSupply += amount;
        _balances[msg.sender] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount)
        public
        nonReentrant
        whenNotPaused
        updateReward(msg.sender)
    {
        require(amount > 0, "Withdraw zero");
        require(_balances[msg.sender] >= amount, "Insufficient");

        _totalSupply -= amount;
        _balances[msg.sender] -= amount;
        stakingToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    function getReward()
        public
        nonReentrant
        whenNotPaused
        updateReward(msg.sender)
    {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            require(
                rewardsToken.balanceOf(address(this)) >= reward,
                "Vault out of rewards"
            );
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    // ================= ADMIN =================
    function setEpochReward(uint256 newReward)
        external
        onlyRole(DISTRIBUTOR_ROLE)
        updateReward(address(0))
    {
        epochReward = newReward;
        emit EpochRewardUpdated(newReward);
    }

    function setEpochDuration(uint256 newDuration)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newDuration >= 1 hours, "Too short");
        epochDuration = newDuration;
        emit EpochDurationUpdated(newDuration);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function recoverERC20(address token, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            token != address(stakingToken) && token != address(rewardsToken),
            "Protected token"
        );
        IERC20Upgradeable(token).safeTransfer(msg.sender, amount);
    }

    // ================= STORAGE GAP =================
    uint256[50] private __gap;
}
