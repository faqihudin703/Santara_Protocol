import { parseAbi } from 'viem';

// 1. Load Addresses
export const CONTRACTS = {
  SWAP: import.meta.env.VITE_CONTRACT_SWAP,
  IDRX: import.meta.env.VITE_CONTRACT_IDRX,
  VAULT: import.meta.env.VITE_CONTRACT_VAULT,
  NXS: import.meta.env.VITE_CONTRACT_NXS,
  REDEEM: import.meta.env.VITE_CONTRACT_REDEEM,
  WSAN: import.meta.env.VITE_CONTRACT_WSAN,
  SETTLEMENT: import.meta.env.VITE_CONTRACT_SETTLE,
  USDC: import.meta.env.VITE_CONTRACT_USDC,
};

// 2. Define ABIs (Hanya fungsi yang kita butuhkan)
export const ABIS = {
  // ERC20 Standard (IDRX & NXS)
  ERC20: parseAbi([
    'function approve(address spender, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)'
  ]),
  
  SETTLEMENT: parseAbi([
    'function settleFiatPayment(uint256 amount, uint256 nonce)',
    'function settlementQuotas(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)',
    'event FiatPaymentSettled(address indexed payer, uint256 amount, bytes32 transferId, uint256 clientNonce, uint256 blockTimestamp)',
  ]),

  // Direct Swap (ETH -> IDRX)
  SWAP: parseAbi([
    // ===== SWAP =====
    'function swapEthForIDRX(uint256 minIDRXOut) payable',
    'function swapWSANForIDRX(uint256 amountWSAN, uint256 minIDRXOut)',
    
    // ===== PRICE / RATE =====
    'function ethToIdrPrice() view returns (uint256)',
    'function getWSanRate() view returns (uint256)',
    
    // ===== STATE =====
    'function lastPriceUpdate() view returns (uint256)',
    
    // ===== FEE =====
    'function swapEthFeeBps() view returns (uint256)',
    'function swapWSanFeeBps() view returns (uint256)'
  ]),

  // Yield Vault (Staking)
  VAULT: parseAbi([
    // user
    'function stake(uint256 amount)',
    'function withdraw(uint256 amount)',
    'function getReward()',
    'function exit()',

    // views
    'function earned(address account) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function totalSupply() view returns (uint256)',

    // epoch
    'function epochDuration() view returns (uint256)',
    'function epochReward() view returns (uint256)',
    'function lastEpochTime() view returns (uint256)',
    'function epochStartTime() view returns (uint256)',

    // ================= STAKING WINDOW =================
    'function stakingWindow() view returns (uint256)',
  ]),

  // Redemption (NXS -> USDC)
  REDEEM: parseAbi([
    'function redeem(uint256 nxsAmount)',
    'function redeemRate() view returns (uint256)'
  ])
};