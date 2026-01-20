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
    return Number(block.timestamp) // seconds
  }, [block])

  /* ========= AMOUNT ========= */
  const parsedAmount = useMemo(
    () => (amount ? parseUnits(amount, 18) : 0n),
    [amount]
  )

  /* ========= READ ========= */
  const { data: earned } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'earned',
    args: [address],
    query: { refetchInterval: 5000 },
  })

  const { data: staked } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'balanceOf',
    args: [address],
  })

  const { data: totalSupply } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: ABIS.VAULT,
    functionName: 'totalSupply',
  })

  const { data: allowance } = useReadContract({
    address: CONTRACTS.IDRX,
    abi: ABIS.ERC20,
    functionName: 'allowance',
    args: [address, CONTRACTS.VAULT],
    query: { enabled: !!address && !!amount },
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
  
  /* ========= STAKING WINDOW (V3) ========= */
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
    if (!epochDuration || !lastEpochTime || !chainNow)
      return '--'

    const duration = Number(epochDuration)
    const elapsed = Math.max(
      0,
      chainNow - Number(lastEpochTime)
    )
    const remaining = duration - (elapsed % duration)

    return formatDuration(remaining)
  }, [epochDuration, lastEpochTime, chainNow])
  
  /* ========= STAKING COUNTDOWN (ALWAYS ON) ========= */
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

    const openUntil = start + window

    // 🔓 staking OPEN
    if (chainNow >= start && chainNow < openUntil) {
      return {
        isOpen: true,
        remaining: openUntil - chainNow,
      }
    }

    // 🔒 staking CLOSED → next epoch
    const epochsPassed = Math.floor((chainNow - start) / duration) + 1

    const nextOpen = start + epochsPassed * duration

    return {
      isOpen: false,
      remaining: Math.max(0, nextOpen - chainNow),
    }
  }, [stakingWindow, epochStartTime, epochDuration, chainNow])

  const isStakingOpen = stakingCountdown?.isOpen

  /* ========= EPOCH PROGRESS (0 → 1) ========= */
  const epochProgress = useMemo(() => {
    if (!epochDuration || !lastEpochTime || !chainNow)
      return 0
    
    const duration = Number(epochDuration)
    const elapsed = Math.max(
      0,
      chainNow - Number(lastEpochTime)
    )

    return Math.min(elapsed / duration, 1)
  }, [epochDuration, lastEpochTime, chainNow])

  /* ========= ESTIMATED REWARD (OFF-CHAIN) ========= */
  const estimatedReward = useMemo(() => {
    if (
      !staked ||
      !totalSupply ||
      totalSupply === 0n ||
      !epochReward
    )
      return 0n

    const userShare =
      (staked * epochReward) / totalSupply
    
    const progressScaled = BigInt(
      Math.floor(epochProgress * 1_000_000)
    )

    return (userShare * progressScaled) / 1_000_000n
  }, [staked, totalSupply, epochReward, epochProgress])
  
  const maxEpochReward = useMemo(() => {
    if (
      !staked ||
      !totalSupply ||
      totalSupply === 0n ||
      !epochReward
    )
      return 0n
    
    return (staked * epochReward) / totalSupply
  }, [staked, totalSupply, epochReward])
  
  const isMaxed = useMemo(() => {
    return (
      maxEpochReward > 0n &&
      estimatedReward >= maxEpochReward
    )
  }, [estimatedReward, maxEpochReward])
  
  const rewardProgressPct = useMemo(() => {
    if (
      maxEpochReward === 0n ||
      estimatedReward === 0n
    )
      return 0

    const pct =
      Number((estimatedReward * 10_000n) / maxEpochReward) / 100

    return Math.min(pct, 100)
  }, [estimatedReward, maxEpochReward])

  /* ========= TX ========= */
  const { writeContract, data: hash, isPending } =
    useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  })

  const isTxRunning = isPending || isConfirming

  /* ========= HANDLERS ========= */
  const handleStake = () => {
    if (!amount || isTxRunning) return

    if (needsApproval) {
      writeContract({
        address: CONTRACTS.IDRX,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACTS.VAULT, parsedAmount],
      })
    } else {
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
    writeContract({
      address: CONTRACTS.VAULT,
      abi: ABIS.VAULT,
      functionName: 'getReward',
    })
  }

  const handleExit = () => {
    if (isTxRunning) return
    writeContract({
      address: CONTRACTS.VAULT,
      abi: ABIS.VAULT,
      functionName: 'exit',
    })
  }

  useEffect(() => {
    if (isSuccess) return 
    queryClient.invalidateQueries()
    setAmount('')
  }, [isSuccess])

  /* ========= UI ========= */
  return (
    <div className="neon-card glow-purple rounded-3xl p-6">
      <h2 className="text-xl font-bold text-purple-400 mb-6">
        Stake IDRX & Earn NXS
      </h2>

      {/* TOP GRID */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-black/60 p-4 rounded-xl">
          <p className="text-xs text-gray-500">Your Staked IDRX</p>
          <p className="font-mono text-lg">
            {staked ? format2(formatEther(staked)) : '0.0'} IDRX
          </p>
        </div>

        <div className="bg-purple-900/10 p-4 rounded-xl">
          <p className="text-xs text-purple-300">
            Claimable Rewards (NXS)
          </p>
          <p className="font-mono text-xl text-purple-200">
            {earned ? format2(formatEther(earned)) : '0.0'} NXS
          </p>
        </div>
      </div>

      {/* ESTIMATED PROGRESS BAR */}
      <div className="bg-purple-900/10 p-4 rounded-xl mb-4">
        <div className="flex justify-between text-xs text-purple-300 mb-2">
          <span>Estimated Rewards (This Epoch)</span>
          <span>{format2(formatEther(estimatedReward))} NXS
          {isMaxed && ( 
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
              MAX
            </span>
          )}
          </span>
        </div>

        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-[width] duration-500 ease-out"
            style={{ width: `${rewardProgressPct}%` }}
          />
        </div>

        <p className="text-[10px] text-gray-500 mt-2">
          {isMaxed
            ? 'Max rewards reached for this epoch'
            : 'Estimated • Based on current stake share • Synced with blockchain time'}
        </p>
      </div>

      {/* BOTTOM GRID */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-black/60 p-4 rounded-xl">
          <p className="text-xs text-gray-500">Reward per Period</p>
          <p className="text-purple-300">
            {epochReward
              ? `${format2(formatEther(epochReward))} NXS`
              : '--'}
          </p>
        </div>

        <div className="bg-black/60 p-4 rounded-xl">
          <p className="text-xs text-gray-500">
            Next Vault Reward Update In
          </p>
          <p className="text-purple-300">{nextEpochIn}</p>
        </div>
        
        <div className="bg-black/60 p-4 rounded-xl">
          <p className="text-xs text-gray-500">Staking</p>
          {isStakingOpen ? (
            <p className="text-green-400">Open</p>
          ) : (
            <p className="text-red-400">Closed</p>
          )}
        </div>
        
        <div className="bg-black/60 p-4 rounded-xl">
          <p className="text-xs text-gray-500">
          {isStakingOpen
            ? 'Staking Closes In'
            : 'Staking Opens In'}
          </p>
          <p
            className={`font-mono ${
              isStakingOpen
                ? 'text-orange-400'
                : 'text-purple-400'
            }`}
          >
            {stakingCountdown
              ? formatDuration(stakingCountdown.remaining)
              : '--'}
          </p>
        </div>
      </div>

      {/* INPUT */}
      <input
        type="number"
        placeholder="Enter Amount to Stake (IDRX)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={isTxRunning || !isStakingOpen}
        className="cyber-input mb-4"
      />

      {/* ACTIONS */}
      <button
        onClick={handleStake}
        disabled={!amount || !isStakingOpen || isTxRunning}
        className={`action-btn mb-3 ${
          isStakingOpen
            ? 'bg-purple-600'
            : 'bg-gray-700 cursor-not-allowed'
        }`}
      >
        {!isStakingOpen
          ? 'Staking Closed'
          : needsApproval
            ? 'Allow IDRX'
            : 'Start Earning'}
      </button>

      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
        <button
          onClick={handleHarvest}
          disabled={!hasReward || isTxRunning}
          className="action-btn bg-green-600"
        >
          Claim Reward
        </button>

        <button
          onClick={handleExit}
          disabled={isTxRunning}
          className="action-btn bg-red-900/30 text-red-400"
        >
          Withdraw All
        </button>
      </div>
    </div>
  )
}