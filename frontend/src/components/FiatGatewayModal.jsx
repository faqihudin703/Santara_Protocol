import { useState, useEffect, useMemo } from 'react'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useBlock,
} from 'wagmi'
import { parseUnits, formatEther } from 'viem'
import { CONTRACTS, ABIS } from '../config'
import { createPortal } from 'react-dom'
import { 
  X, 
  Landmark, 
  CreditCard, 
  Wallet, 
  CheckCircle2, 
  Loader2, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Copy
} from 'lucide-react'

const formatIDR = (num) =>
  new Intl.NumberFormat('id-ID').format(num)

const DAILY_LIMIT = 5_000n * 10n ** 18n

export default function FiatSettlementGateway({ isOpen, onClose }) {
  const { address, isConnected } = useAccount()

  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState('')
  const [nonce, setNonce] = useState(0)
  const [nonceSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000))
  const [nonceCounter, setNonceCounter] = useState(0)
  const [selectedBank, setSelectedBank] = useState('BCA')
  
  const generateClientNonce = () => {
    const n = BigInt(nonceSeed) * 1_000_000n + BigInt(nonceCounter)
    setNonceCounter((c) => c + 1)
    return n
  }
  
  const { data: block } = useBlock({ watch: true })
  const currentTimestamp = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000)

  /* ===== QUOTA READ ===== */
  const { data: quota } = useReadContract({
    address: CONTRACTS.SETTLEMENT,
    abi: ABIS.SETTLEMENT,
    functionName: 'settlementQuotas',
    args: [address],
    query: { enabled: !!address },
  })

  const dailyRemaining = useMemo(() => {
    if (!quota) return DAILY_LIMIT
    
    const dailySettled = quota[0]
    const lastDailyReset = Number(quota[3])
    const oneDaySeconds = 24 * 60 * 60
    
    if (currentTimestamp >= lastDailyReset + oneDaySeconds) {
       return DAILY_LIMIT
    }
    
    return DAILY_LIMIT - dailySettled
  }, [quota, currentTimestamp])
  
  const exceedsDaily = amount && parseUnits(amount, 18) > dailyRemaining

  /* ===== TX ===== */
  const { writeContract, data: hash, isPending } =
    useWriteContract()

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setAmount('')
      setNonce(generateClientNonce())
    }
  }, [isOpen])

  const handleSettlement = () => {
    const usedNonce = generateClientNonce()
    setNonce(usedNonce)
    
    writeContract({
      address: CONTRACTS.SETTLEMENT,
      abi: ABIS.SETTLEMENT,
      functionName: 'settleFiatPayment',
      args: [parseUnits(amount, 18), usedNonce],
    })
    setStep(3)
  }
  
  useEffect(() => {
    if (isSuccess) {
      setStep(4)
    }
  }, [isSuccess])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#12141a] border border-gray-800 rounded-3xl shadow-2xl relative overflow-hidden font-sans">

        {/* HEADER */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#0a0b0d]">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-blue-900/30 rounded-lg flex items-center justify-center border border-blue-500/30">
                <Landmark className="w-4 h-4 text-blue-400" />
             </div>
             <div>
                <h3 className="text-white font-bold text-sm tracking-tight">
                  Fiat Gateway
                </h3>
                <p className="text-[10px] text-blue-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> On-chain Bank Simulation
                </p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-full transition">
             <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">

          {/* STEP 1: INPUT DETAILS */}
          {step === 1 && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              
              {/* BANK SELECTOR */}
              <div>
                 <label className="text-xs text-gray-500 font-bold uppercase mb-2 block ml-1">Select Bank</label>
                 <div className="grid grid-cols-3 gap-2">
                    {['BCA', 'BRI', 'MANDIRI'].map((b) => (
                       <button
                          key={b}
                          onClick={() => setSelectedBank(b)}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                             selectedBank === b
                                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20'
                                : 'bg-[#1c1f26] text-gray-400 border-gray-800 hover:border-gray-600'
                          }`}
                       >
                          {b}
                       </button>
                    ))}
                 </div>
              </div>

              {/* AMOUNT INPUT */}
              <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-gray-800 focus-within:border-blue-500/50 transition">
                 <div className="flex justify-between text-xs text-gray-400 mb-2">
                    <span>Top Up Amount</span>
                    <span className="text-blue-400 font-mono">Min: Rp 1.000</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-mono text-xl mr-2">Rp</span>
                    <input
                       type="number"
                       placeholder="0"
                       value={amount}
                       onChange={(e) => setAmount(e.target.value)}
                       className="bg-transparent text-2xl font-mono text-white outline-none w-full placeholder:text-gray-700"
                    />
                 </div>
              </div>

              {/* LIMIT INFO */}
              <div className="bg-blue-900/10 border border-blue-500/10 rounded-xl p-3 flex items-start gap-3">
                 <Wallet className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                 <div>
                    <p className="text-xs text-blue-200 font-semibold mb-0.5">Daily Quota Remaining</p>
                    <p className="text-white font-mono text-sm font-bold">
                       {dailyRemaining ? formatIDR(formatEther(dailyRemaining)) : '0'} IDRX
                    </p>
                 </div>
              </div>
              
              {exceedsDaily && (
                 <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/10 p-2 rounded-lg border border-red-500/10">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Amount exceeds daily limit.</span>
                 </div>
              )}

              <button
                disabled={!isConnected || !amount || exceedsDaily}
                onClick={() => setStep(2)}
                className="w-full bg-blue-600 hover:bg-blue-500 py-3.5 rounded-xl font-bold text-sm text-white transition disabled:bg-[#1c1f26] disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
              >
                Generate Virtual Account <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: VIRTUAL ACCOUNT DISPLAY */}
          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
               
               <div className="text-center">
                  <p className="text-gray-400 text-xs mb-4">Transfer exact amount to:</p>
                  
                  {/* VA CARD */}
                  <div className="bg-white text-black p-6 rounded-2xl shadow-xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <CreditCard className="w-24 h-24" />
                     </div>

                     <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="font-black text-2xl tracking-tighter italic">{selectedBank}</div>
                        <div className="text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded uppercase">Virtual Account</div>
                     </div>

                     <div className="text-center relative z-10">
                        <div className="font-mono text-2xl font-bold tracking-widest mb-1">
                           {(selectedBank === 'BCA' && '8800') || (selectedBank === 'BRI' && '7777') || '8888'} {address?.slice(-8)}
                        </div>
                        <div className="text-[10px] text-gray-500 font-medium">CHECKED AUTOMATICALLY</div>
                     </div>
                  </div>
               </div>

               <div className="bg-[#0a0b0d] p-4 rounded-xl border border-gray-800 flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-medium">Total Payment</span>
                  <span className="text-xl font-mono font-bold text-blue-400">Rp {formatIDR(amount)}</span>
               </div>
               
               {/* INFO BOX */}
               <div className="text-[10px] text-gray-500 bg-[#1c1f26] p-3 rounded-lg border border-gray-800">
                  <span className="font-bold text-gray-400">Simulation Mode:</span> No real fiat transfer required. This action will mint Testnet IDRX directly to your wallet.
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setStep(1)} className="py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition text-xs font-bold">
                     Back
                  </button>
                  <button
                     onClick={handleSettlement}
                     className="bg-green-600 hover:bg-green-500 py-3 rounded-xl font-bold text-xs text-white transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
                  >
                     <CheckCircle2 className="w-4 h-4" /> I Have Transferred
                  </button>
               </div>
            </div>
          )}

          {/* STEP 3: PROCESSING */}
          {step === 3 && (
            <div className="text-center py-8 animate-in zoom-in-95 duration-300">
               <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                  <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full animate-ping"></div>
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
               </div>
               
               <h4 className="text-lg font-bold text-white mb-2">Verifying Payment...</h4>
               <p className="text-xs text-gray-500 mb-6">Checking on-chain settlement proof.</p>

               {hash && (
                  <a
                     href={`https://sepolia.basescan.org/tx/${hash}`}
                     target="_blank"
                     className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-[#1c1f26] text-blue-400 text-xs hover:text-white transition"
                  >
                     View Transaction <ArrowRight className="w-3 h-3" />
                  </a>
               )}
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 4 && (
            <div className="text-center py-6 animate-in zoom-in-95 duration-300">
               <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
               </div>
               
               <h4 className="text-2xl font-bold text-white mb-1">Payment Settled</h4>
               <p className="text-sm text-gray-400 mb-8">
                  <span className="text-green-400 font-mono font-bold">Rp {formatIDR(amount)}</span> has been credited.
               </p>
               
               <button onClick={onClose} className="w-full bg-[#1c1f26] hover:bg-gray-800 border border-gray-700 text-white font-bold py-3.5 rounded-xl transition">
                  Done
               </button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  )
}