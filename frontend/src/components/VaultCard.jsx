import { useState, useMemo, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBlock,
} from 'wagmi'
import { parseUnits, formatEther } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import { CONTRACTS, ABIS } from '../config'
import { 
  TrendingUp, 
  Lock, 
  Timer, 
  Info, 
  Wallet, 
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react'

const format2 = (value) => {
  if (!value) return '0.00'
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function VaultCard() {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [lastAction, setLastAction] = useState(null)
  const queryClient = useQueryClient()
   
  /* ========= BLOCK TIME (SOURCE OF TRUTH) ========= */
  const { data: block } = useBlock({ watch: true })

  const chainNow = useMemo(() => {
    if (!block) return null
    return Number(block.timestamp)
  }, [block])

  /* ========= AMOUNT ========= */
  const parsedAmount = useMemo(
    () => (amount ? parseUnits(amount, 18) : 0n),
    [amount]
  )

  /* ========= READ DATA & REFETCH HANDLERS ========= */
  
  const { data: earned } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'earned',
    args: [address],
    query: { refetchInterval: 5000 },
  })
  
  const { data: staked, refetch: refetchStaked } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'balanceOf',
    args: [address],
  })
  
  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'totalSupply',
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.IDRX,
    abi: ABIS.ERC20,
    functionName: 'allowance',
    args: [address, CONTRACTS.VAULT],
    query: { enabled: !!address && !!amount },
  })
  
  const { data: idrxWalletBalance, refetch: refetchWallet } = useReadContract({
    address: CONTRACTS.IDRX,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: [address],
  })

  /* ========= EPOCH (GLOBAL) ========= */
  const { data: epochDuration } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'epochDuration',
  })

  const { data: epochReward } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'epochReward',
  })

  const { data: lastEpochTime } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'lastEpochTime',
  })
   
  /* ========= STAKING WINDOW ========= */
  const { data: stakingWindow } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'stakingWindow',
  })

  const { data: epochStartTime } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'epochStartTime',
  })

  /* ========= HELPERS ========= */
  const needsApproval =
    allowance !== undefined && allowance < parsedAmount

  const hasReward = earned && earned > 0n
   
  const formatDuration = (seconds) => {
    if (seconds <= 0) return '0m'

    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)

    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m`
    return `${s}s`
  }

  /* ========= GLOBAL EPOCH COUNTDOWN ========= */
  const nextEpochIn = useMemo(() => {
    if (!epochDuration || !epochStartTime || !chainNow)
      return '--'

    const duration = Number(epochDuration)
    const start = Number(epochStartTime)
    
    const timeSinceGenesis = Math.max(0, chainNow - start)
    const timeIntoCurrentEpoch = timeSinceGenesis % duration
    const remaining = duration - timeIntoCurrentEpoch

    return formatDuration(remaining)
  }, [epochDuration, epochStartTime, chainNow])
   
  /* ========= STAKING COUNTDOWN ========= */
  const stakingCountdown = useMemo(() => {
    if (
      !stakingWindow ||
      !epochStartTime ||
      !epochDuration ||
      !chainNow
    )
      return null

    const start = Number(epochStartTime)
    const window = Number(stakingWindow)
    const duration = Number(epochDuration)

    const timeSinceGenesis = chainNow - start
    const currentEpochStart = start + Math.floor(timeSinceGenesis / duration) * duration
    const openUntil = currentEpochStart + window

    if (chainNow < openUntil) {
      return { isOpen: true, remaining: openUntil - chainNow }
    }

    const nextEpochStart = currentEpochStart + duration
    return { isOpen: false, remaining: nextEpochStart - chainNow }
  }, [stakingWindow, epochStartTime, epochDuration, chainNow])

  const isStakingOpen = stakingCountdown?.isOpen

  /* ========= EPOCH PROGRESS (CYCLIC) ========= */
  const epochProgress = useMemo(() => {
    if (!epochDuration || !epochStartTime || !chainNow)
      return 0
    
    const duration = Number(epochDuration)
    const start = Number(epochStartTime)
    const timeSinceGenesis = Math.max(0, chainNow - start)
    const currentCycleElapsed = timeSinceGenesis % duration

    return Math.min(currentCycleElapsed / duration, 1)
  }, [epochDuration, epochStartTime, chainNow])

  /* ========= ESTIMATED REWARD ========= */
  const estimatedReward = useMemo(() => {
    if (!staked || !totalSupply || totalSupply === 0n || !epochReward)
      return 0n

    const userShare = (staked * epochReward) / totalSupply
    const progressScaled = BigInt(Math.floor(epochProgress * 1_000_000))

    return (userShare * progressScaled) / 1_000_000n
  }, [staked, totalSupply, epochReward, epochProgress])
   
  const maxEpochReward = useMemo(() => {
    if (!staked || !totalSupply || totalSupply === 0n || !epochReward)
      return 0n
    
    return (staked * epochReward) / totalSupply
  }, [staked, totalSupply, epochReward])
   
  const isMaxed = useMemo(() => {
    return (maxEpochReward > 0n && estimatedReward >= maxEpochReward)
  }, [estimatedReward, maxEpochReward])
   
  const rewardProgressPct = useMemo(() => {
    if (maxEpochReward === 0n || estimatedReward === 0n) return 0
    const pct = Number((estimatedReward * 10_000n) / maxEpochReward) / 100
    return Math.min(pct, 100)
  }, [estimatedReward, maxEpochReward])

  /* ========= TX ========= */
  const { writeContract, data: hash, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  })

  const isTxRunning = isPending || isConfirming

  /* ========= HANDLERS ========= */
  const handleStake = () => {
    if (!amount || isTxRunning) return

    if (needsApproval) {
      setLastAction('approve')
      writeContract({
        address: CONTRACTS.IDRX,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACTS.VAULT, parsedAmount],
      })
    } else {
      setLastAction('stake')
      writeContract({
        address: CONTRACTS.VAULT,
        abi: ABIS.VAULT,
        functionName: 'stake',
        args: [parsedAmount],
      })
    }
  }

  const handleHarvest = () => {
    if (!hasReward || isTxRunning) return
    setLastAction('harvest')
    writeContract({
      address: CONTRACTS.VAULT,
      abi: ABIS.VAULT,
      functionName: 'getReward',
    })
  }

  const handleExit = () => {
    if (isTxRunning) return
    setLastAction('exit')
    writeContract({
      address: CONTRACTS.VAULT,
      abi: ABIS.VAULT,
      functionName: 'exit',
    })
  }
  
  useEffect(() => {
    if (isSuccess) {
      refetchStaked()
      refetchWallet()
      refetchTotalSupply()
      refetchAllowance()
      
      if (lastAction === 'stake') {
         setAmount('')
      }
      
      setLastAction(null)
      queryClient.invalidateQueries({ queryKey: ['vaultData'] })
    }
  }, [isSuccess, lastAction, refetchStaked, refetchWallet, refetchTotalSupply, refetchAllowance, queryClient])

  /* ========= UI ========= */
  return (
    <div className="bg-[#12141a] border border-gray-800 rounded-3xl p-4 md:p-6 shadow-2xl relative overflow-hidden font-sans">
       
      {/* HEADER WITH DECORATION */}
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Lock className="w-40 h-40" />
      </div>

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 bg-purple-900/30 rounded-xl flex items-center justify-center border border-purple-500/30 shadow-lg shadow-purple-900/20">
          <TrendingUp className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">NXS Vault</h2>
          <p className="text-xs text-gray-500 font-medium">Auto-compounding Yield</p>
        </div>
      </div>

      {/* --- STATS GRID (PORTFOLIO) --- */}
      <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
        {/* STAKED */}
        <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-gray-800 hover:border-purple-500/30 transition duration-300">
           <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase mb-1">
             <Lock className="w-3 h-3 text-purple-500" /> Staked Balance
           </div>
           <div className="font-mono text-lg font-bold text-white truncate">
             {staked ? format2(formatEther(staked)) : '0.00'} <span className="text-xs text-gray-500 font-sans">IDRX</span>
           </div>
        </div>

        {/* EARNED (CLAIMABLE) */}
        <div className="bg-purple-900/10 p-4 rounded-2xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
           <div className="flex items-center gap-1.5 text-[10px] text-purple-300 font-bold uppercase mb-1">
             <TrendingUp className="w-3 h-3" /> Unclaimed Yield
           </div>
           <div className="font-mono text-lg font-bold text-purple-200 truncate">
             {earned ? format2(formatEther(earned)) : '0.00'} <span className="text-xs text-purple-400/70 font-sans">NXS</span>
           </div>
        </div>
      </div>

      {/* --- PROGRESS BAR (REALTIME ESTIMATION) --- */}
      <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-gray-800 mb-6 relative overflow-hidden group">
        <div className="flex justify-between items-center text-xs text-gray-400 mb-3 relative z-10">
          <span className="flex items-center gap-1.5 font-medium">
             <Timer className="w-3.5 h-3.5 text-blue-400" /> Current Epoch Rewards
          </span>
          <span className="font-mono text-white font-bold">
            {format2(formatEther(estimatedReward))} NXS
            {isMaxed && ( 
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/20">
                MAX
              </span>
            )}
          </span>
        </div>

        {/* Bar Container */}
        <div className="w-full h-2.5 bg-[#1c1f26] rounded-full overflow-hidden relative z-10">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-[width] duration-700 ease-out relative"
            style={{ width: `${rewardProgressPct}%` }}
          >
              <div className="absolute top-0 left-0 bottom-0 right-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full -translate-x-full animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-3 text-[10px] text-gray-500 relative z-10">
             <span>{Math.floor(rewardProgressPct)}% accumulated</span>
             <span className="flex items-center gap-1">
               Epoch ends in <span className="text-gray-300 font-mono">{nextEpochIn}</span>
             </span>
        </div>
      </div>

      {/* --- INFO GRID (DETAILS) --- */}
      <div className="grid grid-cols-2 gap-3 mb-6 text-[10px]">
        <div className="bg-[#1c1f26] p-3 rounded-xl flex flex-col gap-1 border border-gray-800">
           <span className="text-gray-500 font-semibold uppercase">Reward Rate</span>
           <span className="text-gray-300 font-mono text-xs">
              {epochReward ? format2(formatEther(epochReward)) : '--'} NXS/Epoch
           </span>
        </div>

        <div className="bg-[#1c1f26] p-3 rounded-xl flex flex-col gap-1 border border-gray-800">
           <span className="text-gray-500 font-semibold uppercase flex justify-between">
              Staking Status 
              {isStakingOpen ? <span className="text-green-400 font-bold">OPEN</span> : <span className="text-red-400 font-bold">CLOSED</span>}
           </span>
           <span className={`font-mono text-xs ${isStakingOpen ? 'text-green-300' : 'text-orange-400'}`}>
              {isStakingOpen ? 'Closes in ' : 'Opens in '} 
              {stakingCountdown ? formatDuration(stakingCountdown.remaining) : '--'}
           </span>
        </div>
      </div>

      {/* --- INPUT STAKE --- */}
      <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-gray-800 mb-4 focus-within:border-purple-500/50 transition">
         <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Stake Amount</span>
            <span className="flex items-center gap-1">
               <Wallet className="w-3 h-3" /> Bal: <span className="text-white font-mono">
                 {idrxWalletBalance ? format2(formatEther(idrxWalletBalance)) : '0.00'}
              </span>
            </span>
         </div>
         <div className="flex items-center justify-between">
            <input
               type="number"
               placeholder="0.00"
               value={amount}
               onChange={(e) => setAmount(e.target.value)}
               disabled={isTxRunning || !isStakingOpen}
               className="bg-transparent text-2xl font-mono text-white outline-none w-full placeholder:text-gray-700 disabled:opacity-50"
            />
            <button 
               onClick={() => setAmount(idrxWalletBalance ? formatEther(idrxWalletBalance) : '')}
               disabled={isTxRunning || !isStakingOpen}
               className="text-[10px] font-bold bg-[#1c1f26] text-purple-400 px-2 py-1 rounded hover:bg-[#252a33] transition"
            >
               MAX
            </button>
         </div>
      </div>

      {/* --- MAIN ACTION BUTTON --- */}
      <button
        onClick={handleStake}
        disabled={!amount || !isStakingOpen || isTxRunning}
        className={`w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 mb-4 ${
          isStakingOpen
            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/20'
            : 'bg-[#1c1f26] text-gray-500 cursor-not-allowed border border-gray-800'
        }`}
      >
        {isTxRunning && (lastAction === 'stake' || lastAction === 'approve') ? (
           <>
             <Loader2 className="w-4 h-4 animate-spin" />
             Processing...
           </>
        ) : !isStakingOpen ? (
           'Staking Window Closed'
        ) : needsApproval ? (
           'Approve IDRX Usage'
        ) : (
           'Confirm Deposit'
        )}
      </button>

      {/* --- SECONDARY ACTIONS (HARVEST / EXIT) --- */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-800">
        <button
          onClick={handleHarvest}
          disabled={!hasReward || isTxRunning}
          className="py-3 rounded-xl font-bold text-xs bg-[#0a0b0d] border border-green-900/30 text-green-400 hover:bg-green-900/10 hover:border-green-500/50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTxRunning && lastAction === 'harvest' ? <Loader2 className="w-3 h-3 animate-spin"/> : <CheckCircle2 className="w-3 h-3"/>}
          Claim Rewards
        </button>

        <button
          onClick={handleExit}
          disabled={isTxRunning}
          className="py-3 rounded-xl font-bold text-xs bg-[#0a0b0d] border border-red-900/30 text-red-400 hover:bg-red-900/10 hover:border-red-500/50 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
           {isTxRunning && lastAction === 'exit' ? <Loader2 className="w-3 h-3 animate-spin"/> : <ArrowRight className="w-3 h-3"/>}
          Withdraw All
        </button>
      </div>

    </div>
  )
}