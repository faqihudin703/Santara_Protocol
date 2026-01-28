import { useState, useMemo, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useBalance,
} from 'wagmi'
import { parseEther, parseUnits, formatEther } from 'viem'
import { CONTRACTS, ABIS } from '../config'
import FiatSettlementGateway from './FiatGatewayModal'
import { 
  Settings2, 
  Wallet, 
  ArrowDown, 
  Info, 
  ExternalLink, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2
} from 'lucide-react'

const format2 = (value) => {
  if (!value) return '0.00'
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function SwapCard() {
  const { address } = useAccount()

  const [amount, setAmount] = useState('')
  const [inputToken, setInputToken] = useState('ETH')
  const [isFiatModalOpen, setIsFiatModalOpen] = useState(false)
  const [slippage, setSlippage] = useState(1)
  const [lastAction, setLastAction] = useState(null)

  /* ========= FIAT STATE ========= */
  const [autoOpenedFiat, setAutoOpenedFiat] = useState(false)
   
  /* ================= READ FEES FROM CONTRACT ================= */
  const { data: ethFeeBps } = useReadContract({
    address: CONTRACTS.SWAP,
    abi: ABIS.SWAP,
    functionName: 'swapEthFeeBps',
  })
   
  const { data: wSanFeeBps } = useReadContract({
    address: CONTRACTS.SWAP,
    abi: ABIS.SWAP,
    functionName: 'swapWSanFeeBps',
  })
   
  const activeFeeBps = useMemo(() => {
    if (inputToken === 'ETH') return ethFeeBps ? Number(ethFeeBps) : 30
    if (inputToken === 'wSAN') return wSanFeeBps ? Number(wSanFeeBps) : 10
    return 0
  }, [inputToken, ethFeeBps, wSanFeeBps])

  /* ================= AMOUNT ================= */

  const parsedAmount = useMemo(
    () => (amount ? parseUnits(amount, 18) : 0n),
    [amount]
  )

  /* ================= BALANCES & REFETCH HANDLERS ================= */
  const { data: ethBalanceData, refetch: refetchEth } = useBalance({
    address,
    query: {
      enabled: !!address,
    } 
  })
  
  const { data: wsanBalance, refetch: refetchWsan } = useReadContract({
    address: CONTRACTS.WSAN,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: [address],
  })
  
  const { data: idrxBalance, refetch: refetchIdrx } = useReadContract({
    address: CONTRACTS.IDRX,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: [address],
  })

  /* ================= PRICE DATA ================= */
  const { data: ethToIdrPrice } = useReadContract({
    address: CONTRACTS.SWAP,
    abi: ABIS.SWAP,
    functionName: 'ethToIdrPrice',
  })

  const { data: wSanRate } = useReadContract({
    address: CONTRACTS.SWAP,
    abi: ABIS.SWAP,
    functionName: 'getWSanRate',
    query: {
      enabled: inputToken === 'wSAN',
    },
  })
   
  /* ================= RATE DISPLAY LOGIC ================= */
  const currentRate = useMemo(() => {
    if (inputToken === 'ETH' && ethToIdrPrice) {
      return Number(ethToIdrPrice)
    }
    if (inputToken === 'wSAN' && wSanRate) {
      return Number(formatEther(wSanRate)) 
    }
    return 0
  }, [inputToken, ethToIdrPrice, wSanRate])

  /* ================= ALLOWANCE ================= */
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.WSAN,
    abi: ABIS.ERC20,
    functionName: 'allowance',
    args: [address, CONTRACTS.SWAP],
    query: {
      enabled: inputToken === 'wSAN' && !!address && !!amount,
    },
  })

  const needsApproval =
    inputToken === 'wSAN' &&
    allowance !== undefined &&
    allowance < parsedAmount

  /* ========= DYNAMIC SLIPPAGE LOGIC ========= */
  const effectiveSlippage = useMemo(() => {
    if (typeof slippage === 'number') return slippage
    
    if (slippage === 'auto') {
       if (inputToken === 'wSAN') return 1.0
       return 0.5
    }
    return 0.5
  }, [slippage, inputToken])

  /* ================= ESTIMATION WITH FEE ================= */
   
  const feeAmount = useMemo(() => {
      if (!amount) return 0n
      return (parsedAmount * BigInt(activeFeeBps)) / 10000n
  }, [amount, parsedAmount, activeFeeBps])
   
  const netAmount = useMemo(() => {
      if (!amount) return 0n
      return parsedAmount - feeAmount
  }, [parsedAmount, feeAmount])
   
  const expectedIDRX = useMemo(() => {
    if (!amount) return 0n

    if (inputToken === 'ETH' && ethToIdrPrice) {
      const grossIDRX = parsedAmount * ethToIdrPrice
      const feeIDRX = (grossIDRX * BigInt(activeFeeBps)) / 10000n
      return grossIDRX - feeIDRX
    }

    if (inputToken === 'wSAN' && wSanRate) {
       const grossIDRX = (parsedAmount * wSanRate) / 10n**18n
       const feeIDRX = (grossIDRX * BigInt(activeFeeBps)) / 10000n
       return grossIDRX - feeIDRX
    }

    return 0n
  }, [amount, parsedAmount, ethToIdrPrice, wSanRate, inputToken, activeFeeBps])

  const minIDRXOut = useMemo(() => {
    if (!expectedIDRX) return 0n
    const slippageBps = BigInt(Math.floor(effectiveSlippage * 100))
    return (expectedIDRX * (10000n - slippageBps)) / 10000n
  }, [expectedIDRX, slippage])

  /* ================= TX ================= */

  const { writeContract, data: hash, isPending } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
    isError,
  } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  })

  const isTxRunning = isPending || isConfirming

  /* ================= EFFECT (UI STATE) ================= */
   
  useEffect(() => {
    if (
      inputToken === 'IDR' && !autoOpenedFiat
    ) {
      setIsFiatModalOpen(true)
      setAutoOpenedFiat(true)
    }
  }, [inputToken, autoOpenedFiat])
   
  useEffect(() => {
    if (inputToken !== 'IDR') {
      setAutoOpenedFiat(false)
    }
  }, [inputToken])
  
  useEffect(() => {
    if (isSuccess) {
      refetchEth()
      refetchWsan()
      refetchIdrx()
      refetchAllowance()
      
      if (lastAction !== 'approve') {
         setAmount('')
      }
      setLastAction(null)
    }
  }, [isSuccess, refetchEth, refetchWsan, refetchIdrx, refetchAllowance])

  /* ================= ACTION ================= */

  const handleAction = () => {
    if (!amount || isTxRunning) return

    if (inputToken === 'IDR') {
      setIsFiatModalOpen(true)
      return
    }

    if (inputToken === 'ETH') {
      setLastAction('swap')
      writeContract({
        address: CONTRACTS.SWAP,
        abi: ABIS.SWAP,
        functionName: 'swapEthForIDRX',
        args: [minIDRXOut],
        value: parsedAmount,
      })
      return
    }

    if (needsApproval) {
      setLastAction('approve')
      writeContract({
        address: CONTRACTS.WSAN,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACTS.SWAP, parsedAmount],
      })
    } else {
      setLastAction('swap')
      writeContract({
        address: CONTRACTS.SWAP,
        abi: ABIS.SWAP,
        functionName: 'swapWSANForIDRX',
        args: [parsedAmount, minIDRXOut],
      })
    }
  }
   
  /* ================= UI ================= */

  return (
    <div className="bg-[#12141a] border border-gray-800 rounded-3xl p-2 md:p-4 shadow-2xl relative overflow-hidden font-sans">
       
      {/* HEADER CARD */}
      <div className="flex justify-between items-center px-4 py-3 mb-2">
        <h2 className="text-white font-bold text-lg tracking-tight">Swap</h2>
      </div>

      <div className="flex-1 space-y-2">

        {/* --- TOKEN SELECTION (SEGMENTED CONTROL) --- */}
        <div className="bg-[#0a0b0d] p-1.5 rounded-xl flex border border-gray-800 mb-4">
          {['ETH', 'wSAN', 'IDR'].map((t) => (
            <button
              key={t}
              onClick={() => setInputToken(t)}
              disabled={isTxRunning}
              className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all duration-300 ${
                inputToken === t
                  ? 'bg-[#1c1f26] text-blue-400 shadow-lg border border-gray-700'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* --- INPUT SECTION (PAY) --- */}
        {inputToken !== 'IDR' && (
          <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-gray-800 hover:border-gray-700 transition group focus-within:border-blue-500/50">
            <div className="flex justify-between text-gray-400 text-xs font-medium mb-3">
              <span>You Pay</span>
              <span className="flex items-center gap-1.5 text-blue-400">
                <Wallet className="w-3 h-3" /> 
                Bal: <span className="font-mono text-white">
                  {inputToken === 'ETH' 
                    ? (ethBalanceData ? format2(ethBalanceData.formatted) : '0.00')
                    : (wsanBalance ? format2(formatEther(wsanBalance)) : '0.00')
                  }
                </span>
              </span>
            </div>
             
            <div className="flex justify-between items-center">
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isTxRunning}
                className="bg-transparent text-3xl md:text-4xl font-mono font-medium text-white outline-none w-full placeholder:text-gray-700"
              />
              <span className="bg-[#1c1f26] text-white px-3 py-1.5 rounded-full text-sm font-bold border border-gray-700 shrink-0 ml-2 shadow-sm">
                 {inputToken}
              </span>
            </div>
          </div>
        )}

        {/* --- DIVIDER ICON --- */}
        {inputToken !== 'IDR' && (
           <div className="relative h-4 z-10">
             <div className="absolute left-1/2 -translate-x-1/2 -top-3 bg-[#12141a] p-1 rounded-xl border border-gray-800">
                <div className="bg-[#1c1f26] p-1.5 rounded-lg text-gray-400">
                   <ArrowDown className="w-4 h-4" />
                </div>
             </div>
           </div>
        )}
        
        {/* --- PREVIEW (RECEIVE) --- */}
        {inputToken !== 'IDR' && (
           <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-gray-800 mt-2 z-0">
              <div className="flex justify-between text-gray-400 text-xs font-medium mb-2">
                 <span>You Receive (Est.)</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className={`text-2xl md:text-3xl font-mono font-medium truncate pr-2 ${expectedIDRX > 0n ? 'text-white' : 'text-gray-600'}`}>
                    {expectedIDRX > 0n ? format2(formatEther(minIDRXOut)) : '0.00'}
                 </span>
                 <span className="bg-[#1c1f26] text-white px-3 py-1.5 rounded-full text-sm font-bold border border-gray-700 shrink-0 shadow-sm flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-[8px] font-bold">ID</div>
                    IDRX
                 </span>
              </div>
           </div>
        )}

        {/* --- LIVE RATE & INFO SECTION --- */}
        {inputToken !== 'IDR' && (
           <div className="mt-4 space-y-3">
              
              {/* 1. RATE DISPLAY CARD */}
              <div className="bg-[#0a0b0d] border border-gray-800/50 rounded-xl p-3 flex justify-between items-center shadow-inner">
                 <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    <span>Live Rate</span>
                 </div>
                 <div className="flex items-center gap-2">
                    {currentRate > 0 ? (
                      <div className="flex items-center gap-2">
                         <span className="relative flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                         </span>
                         <span className="text-xs font-mono font-bold text-gray-200">
                            1 {inputToken} ≈ {format2(currentRate)} IDRX
                         </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600 animate-pulse flex items-center gap-1">
                         <Loader2 className="w-3 h-3 animate-spin" /> Fetching...
                      </span>
                    )}
                 </div>
              </div>

              {/* 2. SLIPPAGE & FEE ROW */}
              <div className="px-1 flex justify-between items-center">
                 {/* Slippage Selector */}
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Slippage</span>
                    <div className="flex bg-[#0a0b0d] rounded-lg p-0.5 border border-gray-800">
                       
                       {/* AUTO Dynamic Button */}
                       <button 
                          onClick={() => setSlippage('auto')} 
                          disabled={isTxRunning} 
                          className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
                             slippage === 'auto'
                             ? 'bg-blue-700 text-white shadow-sm border border-blue-600'
                             : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                          }`}
                       >
                          Auto
                          {slippage === 'auto' && (
                            <span className="opacity-70 font-bold">({effectiveSlippage}%)</span>
                          )}
                       </button>

                       {/* Manual Button */}
                       {[0.5, 1.0, 2.0].map((v) => (
                          <button 
                            key={v} 
                            onClick={() => setSlippage(v)} 
                            disabled={isTxRunning} 
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                               slippage === v 
                               ? 'bg-blue-700 text-white shadow-sm border border-blue-600' 
                               : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                          >
                             {v}%
                          </button>
                       ))}
                    </div>
                 </div>
                 
                 {/* Fee Display */}
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-500 font-medium">Protocol Fee</span>
                    <span className="text-[10px] text-orange-400 font-mono font-bold border-b border-orange-500/20 leading-none pb-0.5">
                       {(activeFeeBps / 100).toFixed(2)}%
                    </span>
                 </div>
              </div>

           </div>
        )}
        
        {/* --- wSAN HELPER BOX --- */}
        {inputToken === 'wSAN' && (
          <div className="bg-blue-900/10 border border-blue-500/10 p-3 rounded-xl flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div className="flex-1">
               <p className="text-xs text-blue-200 mb-1">Need wSAN?</p>
               <a
                  href="https://lisk-dapps.serverfaqih.my.id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:text-white transition flex items-center gap-1 font-semibold"
                >
                  Bridge from Lisk Sepolia or Swap on DEX <ExternalLink className="w-3 h-3" />
                </a>
            </div>
          </div>
        )}
        
        {/* --- ORACLE INFO --- */}
        <div className="px-2 pt-2">
            <p className="text-[10px] text-gray-500 leading-relaxed flex flex-wrap gap-1 items-center">
               <span>Exchange rates powered by</span>
               <a
                  href="https://oracle-dash.serverfaqih.my.id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-400 font-bold hover:underline decoration-dotted underline-offset-2 transition-colors inline-flex items-center gap-0.5"
                  title="View Live Oracle Dashboard"
               >
                  Santara Oracle Node
                  <ExternalLink className="w-2.5 h-2.5" />
               </a>
            </p>
        </div>
        
        <div className="px-2 mt-3 pt-3 border-t border-gray-800 flex justify-between items-center">
           <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
              <Wallet className="w-3 h-3" /> Your IDRX Balance:
           </span>
           <span className="text-xs font-mono font-bold text-white tracking-wide">
              {idrxBalance ? format2(formatEther(idrxBalance)) : '0.00'} IDRX
           </span>
        </div>

      </div>

      {/* --- ACTION BUTTON --- */}
      {inputToken !== 'IDR' && (
        <button 
          onClick={handleAction}
          disabled={!amount || isTxRunning}
          className={`w-full mt-6 py-4 rounded-xl font-bold text-base transition-all duration-200 shadow-lg flex items-center justify-center gap-2 ${
            isTxRunning
              ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-700'
              : needsApproval
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20' // Approve Style
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20' // Swap Style
          } disabled:opacity-50 disabled:shadow-none`}
        >
          {isTxRunning ? (
             <>
               <Loader2 className="w-5 h-5 animate-spin" />
               {isPending && lastAction === 'approve' && 'Approving...'}
               {isPending && lastAction === 'swap' && 'Confirming Swap...'}
               {isConfirming && 'Indexing...'}
             </>
          ) : (
             <>
               {inputToken === 'wSAN'
                  ? needsApproval
                    ? 'Approve wSAN Usage'
                    : 'Swap wSAN'
                  : 'Swap ETH'}
             </>
          )}
        </button>
      )}

      {/* --- STATUS MESSAGES --- */}
      {isConfirming && (
        <div className="mt-3 flex items-center justify-center gap-2 text-yellow-500 bg-yellow-900/10 p-2 rounded-lg border border-yellow-500/10 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-xs font-semibold">Waiting for block confirmation...</span>
        </div>
      )}

      {isSuccess && lastAction === 'swap' && (
        <div className="mt-3 flex items-center justify-center gap-2 text-green-400 bg-green-900/10 p-2 rounded-lg border border-green-500/10">
          <CheckCircle2 className="w-3 h-3" />
          <span className="text-xs font-semibold">Swap Successful! Balance updated.</span>
        </div>
      )}

      {isError && (
        <div className="mt-3 flex items-center justify-center gap-2 text-red-400 bg-red-900/10 p-2 rounded-lg border border-red-500/10">
          <AlertTriangle className="w-3 h-3" />
          <span className="text-xs font-semibold">Transaction Failed. Check slippage.</span>
        </div>
      )}
       
      {/* FIAT MODAL */}
      <FiatSettlementGateway 
        isOpen={isFiatModalOpen}
        onClose={() => setIsFiatModalOpen(false)}
      />
    </div>
  )
}