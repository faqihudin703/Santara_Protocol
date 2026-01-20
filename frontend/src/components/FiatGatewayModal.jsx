import { useState, useEffect, useMemo } from 'react'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi'
import { parseUnits, formatEther } from 'viem'
import { CONTRACTS, ABIS } from '../config'
import { createPortal } from 'react-dom'

const formatIDR = (num) =>
  new Intl.NumberFormat('id-ID').format(num)

const DAILY_LIMIT = 5_000n * 10n ** 18n
const WEEKLY_LIMIT = 35_000n * 10n ** 18n
const MONTHLY_LIMIT = 150_000n * 10n ** 18n

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

  /* ===== QUOTA READ ===== */
  const { data: quota } = useReadContract({
    address: CONTRACTS.SETTLEMENT,
    abi: ABIS.SETTLEMENT,
    functionName: 'settlementQuotas',
    args: [address],
    query: { enabled: !!address },
  })

  const dailyRemaining = useMemo(
    () => (quota ? DAILY_LIMIT - quota[0] : DAILY_LIMIT),
    [quota]
  )
  
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-gray-800 rounded-2xl">

        {/* HEADER */}
        <div className="p-4 border-b border-gray-800 flex justify-between">
          <div>
            <h3 className="text-white font-bold text-sm">
              Fiat Settlement Gateway
            </h3>
            <p className="text-[10px] text-blue-400">
              On-chain Bank Simulation
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>

        <div className="p-6 space-y-4">

          {/* STEP 1 */}
          {step === 1 && (
            <>
              {/* BANK */}
              <div className="flex gap-2">
                {['BCA', 'BRI', 'MANDIRI'].map((b) => (
                  <button
                    key={b}
                    onClick={() => setSelectedBank(b)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold ${
                      selectedBank === b
                        ? 'bg-blue-600 text-white'
                        : 'bg-black/40 text-gray-400'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>

              {/* AMOUNT */}
              <input
                type="number"
                placeholder="1000 - 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-gray-900 text-white p-3 rounded-lg"
              />

              {/* LIMIT */}
              <div className="bg-black/40 border border-white/10 rounded-xl p-3">
                <p className="text-xs text-gray-400">Daily Remaining</p>
                <p className="text-white font-mono">
                  {formatEther(dailyRemaining)} IDRX
                </p>
              </div>

              <button
                disabled={!isConnected || !amount || exceedsDaily}
                onClick={() => setStep(2)}
                className="w-full bg-blue-600 py-3 rounded-lg disabled:bg-gray-800"
              >
                Generate Virtual Account
              </button>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <div className="bg-white text-black p-4 rounded-lg text-center">
                <div className="font-bold text-xl">{selectedBank}</div>
                <div className="font-mono text-lg">
                  {(selectedBank === 'BCA' && '8800') ||
                    (selectedBank === 'BRI' && '7777') ||
                    '8888'}{' '}
                  {address?.slice(-8)}
                </div>
              </div>

              <div className="text-center text-blue-400 font-bold">
                Rp {formatIDR(amount)}
              </div>
              
              <div className="mt-3 text-[10px] text-gray-400">
                Client Nonce (On-chain reference)
              </div>

              <div className="font-mono text-xs text-white break-all">
                {nonce?.toString()}
              </div>

              <button
                onClick={handleSettlement}
                className="w-full bg-green-600 py-3 rounded-lg"
              >
                I Have Transferred
              </button>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="text-center">
              <p className="text-white">Settling payment...</p>
              {hash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${hash}`}
                  target="_blank"
                  className="text-xs text-blue-400 underline"
                >
                  View TX
                </a>
              )}
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="text-center">
              <h4 className="text-green-400 font-bold">
                Payment Settled
              </h4>
              <p className="text-gray-400 text-sm">
                Rp {formatIDR(amount)} credited
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}