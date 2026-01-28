import { useState, useMemo, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseUnits, formatUnits, formatEther } from 'viem'
import { CONTRACTS, ABIS } from '../config'
import { 
  Banknote, 
  Wallet, 
  ArrowDown, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  RefreshCw,
  Landmark
} from 'lucide-react'

const format2 = (value) => {
  if (!value) return '0.00'
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function RedeemCard() {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [lastAction, setLastAction] = useState(null)

  /* ================= READ RATE FROM CONTRACT ================= */
  
  const { data: rateData, isLoading: isRateLoading } = useReadContract({
    address: CONTRACTS.REDEEM,
    abi: ABIS.REDEEM,
    functionName: 'redeemRate',
    query: { refetchInterval: 10000 }
  })
  
  const currentRate = useMemo(() => {
    if (!rateData) return 0
    return Number(formatUnits(rateData, 6))
  }, [rateData])
  
  /* ================= READ TREASURY LIQUIDITY (NEW) ================= */
  const { data: treasuryLiquidityRaw, refetch: refetchTreasury } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: [CONTRACTS.REDEEM],
    query: { refetchInterval: 5000 }
  })
  
  const treasuryLiquidity = useMemo(() => {
    if (!treasuryLiquidityRaw) return 0
    return Number(formatUnits(treasuryLiquidityRaw, 6))
  }, [treasuryLiquidityRaw])

  /* ================= AMOUNT ================= */

  const parsedAmount = useMemo(
    () => (amount ? parseUnits(amount, 18) : 0n),
    [amount]
  )

  const estimatedUSDC = amount
    ? (parseFloat(amount) * currentRate)
    : 0
  
  const isLiquiditySufficient = treasuryLiquidity >= estimatedUSDC

  /* ================= BALANCE ================= */

  const { data: nxsBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.NXS,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: [address],
  })

  /* ================= ALLOWANCE ================= */

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.NXS,
    abi: ABIS.ERC20,
    functionName: 'allowance',
    args: [address, CONTRACTS.REDEEM],
    query: { enabled: !!address && !!amount },
  })

  const needsApproval =
    allowance !== undefined && allowance < parsedAmount

  /* ================= TX ================= */

  const { writeContract, data: hash, isPending } =
    useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
    isError,
  } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  })

  const isTxRunning = isPending || isConfirming

  /* ================= ACTION ================= */

  const handleAction = () => {
    if (!amount || isTxRunning) return
    if (!isLiquiditySufficient) return

    if (needsApproval) {
      setLastAction('approve')
      writeContract({
        address: CONTRACTS.NXS,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACTS.REDEEM, parsedAmount],
      })
    } else {
      setLastAction('redeem')
      writeContract({
        address: CONTRACTS.REDEEM,
        abi: ABIS.REDEEM,
        functionName: 'redeem',
        args: [parsedAmount],
      })
    }
  }

  /* ================= EFFECT ================= */

  useEffect(() => {
    if (isSuccess) {
      if (lastAction === 'redeem') {
        setAmount('')
      }
      setTimeout(() => setLastAction(null), 3000)
      refetchBalance()
      refetchTreasury()
      refetchAllowance()
    }
  }, [isSuccess, lastAction, refetchBalance, refetchTreasury, refetchAllowance])

  /* ================= UI ================= */

  return (
    <div className="bg-[#12141a] border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden font-sans group">
      
      {/* HEADER WITH DECORATION */}
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition duration-700">
        <Banknote className="w-40 h-40" />
      </div>

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 bg-orange-900/30 rounded-xl flex items-center justify-center border border-orange-500/30 shadow-lg shadow-orange-900/20">
          <Banknote className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Redeem NXS</h2>
          <p className="text-xs text-gray-500 font-medium">Cash Out Rewards</p>
        </div>
      </div>

      <div className="relative mb-6 z-10 space-y-2">
        
        {/* INPUT NXS (PAY) */}
        <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-gray-800 hover:border-orange-500/30 transition focus-within:border-orange-500/50">
           <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>You Redeem</span>
              <span className="flex items-center gap-1.5 text-orange-400">
                 <Wallet className="w-3 h-3" /> 
                 Bal: <span className="font-mono text-white">{nxsBalance ? format2(formatEther(nxsBalance)) : '0.00'}</span>
              </span>
           </div>
           
           <div className="flex justify-between items-center">
              <input
                 type="number"
                 placeholder="0.00"
                 value={amount}
                 onChange={(e) => setAmount(e.target.value)}
                 disabled={isTxRunning}
                 className="bg-transparent text-3xl font-mono text-white outline-none w-full placeholder:text-gray-700"
              />
              <div className="flex gap-2 shrink-0">
                 <button className="text-[10px] font-bold bg-[#1c1f26] text-orange-400 px-2 py-1 rounded hover:bg-[#252a33] transition" onClick={() => setAmount(nxsBalance ? formatEther(nxsBalance) : '')} disabled={isTxRunning}>
                    MAX
                 </button>
                 <span className="bg-[#1c1f26] text-white px-3 py-1.5 rounded-full text-sm font-bold border border-gray-700 shadow-sm">
                    NXS
                 </span>
              </div>
           </div>
        </div>

        {/* --- DIVIDER & DYNAMIC RATE (REALTIME) --- */}
        <div className="relative py-2 flex items-center justify-center">
            
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
               <div className="w-full border-t border-gray-800"></div>
            </div>

            <div className="relative bg-[#12141a] px-3 py-1">
               <div className="flex items-center gap-2 bg-[#1c1f26] border border-gray-700 rounded-full px-3 py-1 shadow-sm">
                  {isRateLoading ? (
                     <Loader2 className="w-3 h-3 text-orange-400 animate-spin" />
                  ) : (
                     <Info className="w-3 h-3 text-green-500" />
                  )}
                  
                  <span className="text-[10px] text-gray-400 font-medium">Rate:</span>
                  
                  <span className="text-[10px] text-orange-400 font-mono font-bold flex items-center gap-1">
                    1 NXS ≈ ${currentRate.toFixed(2)} USDC
                  </span>
               </div>
            </div>
        </div>

        {/* OUTPUT USDC (RECEIVE) */}
        <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-gray-800">
           <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span className="text-gray-400">You Receive (Est.)</span>
                 {isLiquiditySufficient ? (
                 /* CUKUP: Tampilkan Saldo Treasury Hijau */
                 <span className="flex items-center gap-1.5 text-green-400 font-bold animate-in fade-in">
                    <CheckCircle2 className="w-3 h-3" /> 
                    <span className="text-[10px] uppercase tracking-wider">Treasury Ready:</span>
                    <span className="font-mono text-white">${format2(treasuryLiquidity)}</span>
                 </span>
              ) : (
                 /* KURANG: Tampilkan Alert Merah */
                 <span className="flex items-center gap-1.5 text-red-400 font-bold animate-pulse">
                    <AlertTriangle className="w-3 h-3" /> 
                    <span className="text-[10px] uppercase tracking-wider">Low Liquidity:</span>
                    <span className="font-mono text-white">${format2(treasuryLiquidity)}</span>
                 </span>
              )}
           </div>
           
           <div className="flex justify-between items-center">
              <span className={`text-3xl font-mono font-bold ${isLiquiditySufficient ? 'text-white' : 'text-red-500 opacity-50'}`}>
                 ${estimatedUSDC.toFixed(2)}
              </span>
              <span className="bg-[#1c1f26] text-white px-3 py-1.5 rounded-full text-sm font-bold border border-gray-700 shadow-sm flex items-center gap-2">
                 <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">$</div>
                 USDC
              </span>
           </div>
        </div>

      </div>

      {/* ACTION BUTTON */}
      <button
        onClick={handleAction}
        disabled={!amount || isTxRunning || !isLiquiditySufficient}
        className={`w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 mb-4 ${
          !isLiquiditySufficient 
            ? 'bg-red-900/20 text-red-500 border border-red-500/20 cursor-not-allowed' // State Likuiditas Habis
            : isTxRunning
            ? 'bg-[#1c1f26] text-gray-500 cursor-not-allowed border border-gray-800'
            : needsApproval
            ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/20'
            : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/20'
        }`}
      >
        {isTxRunning ? (
           <>
             <Loader2 className="w-4 h-4 animate-spin" />
             {isPending ? 'Processing...' : 'Confirming...'}
           </>
        ) : !isLiquiditySufficient ? (
            'Insufficient Treasury Liquidity'
        ) : needsApproval ? (
            'Approve NXS Usage'
        ) : (
            `Cash Out $${estimatedUSDC.toFixed(2)}`
        )}
      </button>

      {/* STATUS ALERTS */}
      {isSuccess && lastAction === 'redeem' && (
        <div className="flex items-center justify-center gap-2 text-green-400 bg-green-900/10 p-2 rounded-lg border border-green-500/10 text-xs mb-4">
          <CheckCircle2 className="w-3 h-3" />
          <span>Redemption Successful! Check your wallet.</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-center gap-2 text-red-400 bg-red-900/10 p-2 rounded-lg border border-red-500/10 text-xs mb-4">
          <AlertTriangle className="w-3 h-3" />
          <span>Transaction Failed. Check your balance.</span>
        </div>
      )}
      
      {/* INFO FOOTER */}
      <div className="mt-2 flex items-start gap-2 text-[10px] text-gray-500 bg-[#1c1f26] p-2.5 rounded-lg border border-gray-800">
         <Info className="w-3 h-3 shrink-0 mt-0.5 text-orange-400" />
         <div>
            <span className="font-bold text-gray-400">On-Chain Rate:</span> This rate is determined by the smart contract and is backed by treasury reserves.
         </div>
      </div>
      
      <div className="mt-2 flex items-start gap-2 text-[10px] text-gray-500 bg-[#1c1f26] p-2.5 rounded-lg border border-gray-800">
         <Landmark className="w-3 h-3 shrink-0 mt-0.5 text-blue-400" />
         <div>
            <span className="font-bold text-gray-400">Treasury Transparency:</span> We display the real-time USDC balance of the redemption contract directly from the blockchain.
         </div>
      </div>

    </div>
  )
}