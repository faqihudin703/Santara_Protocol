import { useState, useMemo, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from 'wagmi'
import { parseEther, parseUnits, formatEther } from 'viem'
import { CONTRACTS, ABIS } from '../config'
import FiatSettlementGateway from './FiatGatewayModal'

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

  /* ================= AMOUNT ================= */

  const parsedAmount = useMemo(
    () => (amount ? parseUnits(amount, 18) : 0n),
    [amount]
  )

  /* ================= BALANCES ================= */

  const { data: wsanBalance } = useReadContract({
    address: CONTRACTS.WSAN,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: [address],
  })

  const { data: idrxBalance } = useReadContract({
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

  /* ================= ALLOWANCE ================= */

  const { data: allowance } = useReadContract({
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

  /* ================= ESTIMATION ================= */

  const expectedIDRX = useMemo(() => {
    if (!amount) return 0n

    if (inputToken === 'ETH' && ethToIdrPrice) {
      return parseEther(amount) * ethToIdrPrice
    }

    if (inputToken === 'wSAN' && wSanRate) {
      return (parsedAmount * wSanRate) / 10n ** 18n
    }

    return 0n
  }, [amount, parsedAmount, ethToIdrPrice, wSanRate, inputToken])

  const minIDRXOut = useMemo(() => {
    if (!expectedIDRX) return 0n
    return (expectedIDRX * BigInt(100 - slippage)) / 100n
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

  /* ================= EFFECT ================= */
  
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
      setAmount('')
      setLastAction(null)
    }
  }, [isSuccess])

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
        value: parseEther(amount),
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
    <div className="neon-card glow-blue rounded-3xl p-6 h-full flex flex-col justify-between relative">
      <div className="flex-1 overflow-y-auto pr-1">
        <h2 className="text-xl font-bold text-blue-400 mb-6">
          Buy IDRX
        </h2>

        {/* TOGGLE */}
        <div className="bg-black/40 p-1 rounded-xl mb-6 flex border border-white/5">
          {['ETH', 'wSAN', 'IDR'].map((t) => (
            <button
              key={t}
              onClick={() => {
                setInputToken(t)
              }}
              disabled={isTxRunning}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
                inputToken === t
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* INPUT */}
        {inputToken !== 'IDR' && (
          <input
            type="number"
            step="0.01"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isTxRunning}
            className="cyber-input mb-4 disabled:opacity-50"
          />
        )}
        
        {inputToken !== 'IDR' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Slippage tolerance</span>
              <span>{slippage}%</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setSlippage(v)}
                  disabled={isTxRunning}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    slippage === v
                      ? 'bg-blue-600 text-white'
                      : 'bg-black/40 text-gray-400 hover:text-white'
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* PREVIEW */}
        {expectedIDRX > 0n && (
          <p className="text-xs text-gray-400 mb-3">
            You will receive at least{' '}
            <span className="text-white font-mono">
              {format2(formatEther(minIDRXOut))} IDRX
            </span>
          </p>
        )}
        
        {/* wSAN INFO */}
        {inputToken === 'wSAN' && (
          <div className="mb-4 bg-blue-900/10 border border-blue-500/20 p-3 rounded-xl">
            <div className="flex justify-between text-xs text-blue-300">
              <span>Your wSAN</span>
              <span className="font-mono text-white">
                {wsanBalance ? format2(formatEther(wsanBalance)) : '0.0'}
              </span>
            </div>
            <a
              href="https://lisk-dapps.serverfaqih.my.id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:text-white transition flex items-center justify-end gap-1"
            >
              Don’t have wSAN? Get it from Bridge or DEX <span>↗</span>
            </a>
          </div>
        )}
        
        <p className="text-xs text-gray-400">
          Your IDRX:{' '}
          <span className="text-white font-mono">
            {idrxBalance ? format2(formatEther(idrxBalance)) : '0.00'}
          </span>
        </p>
        <p className="mt-1 text-[10px] text-gray-500">
          Exchange rates are powered by a custom off-chain oracle that fetches real-time ETH/IDR market data from Indodax API and publishes it on-chain.
        </p>
      </div>

      {/* ACTION */}
      {inputToken !== 'IDR' && (
        <button 
          onClick={handleAction}
          disabled={!amount || isTxRunning}
          className={`action-btn mt-4 ${
            isTxRunning
              ? 'bg-gray-700 cursor-not-allowed'
              : needsApproval
              ? 'bg-gray-800 hover:bg-gray-700'
              : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          {isPending && lastAction === 'approve' && 'Allow wSAN...'}
          {isPending && lastAction === 'swap' && 'Processing Swap...'}
          {isConfirming && 'Confirming...'}
          {!isTxRunning &&
            (inputToken === 'wSAN'
              ? needsApproval
                ? 'Allow wSAN'
                : 'Swap wSAN for IDRX'
              : 'Swap ETH for IDRX')}
        </button>
      )}

      {/* STATUS */}
      {isConfirming && (
        <p className="text-yellow-400 text-xs text-center mt-2">
          Confirming transaction...
        </p>
      )}

      {isSuccess && lastAction === 'swap' && (
        <p className="text-green-400 text-xs text-center mt-2">
          Swap successful! IDRX received.
        </p>
      )}

      {isError && (
        <p className="text-red-400 text-xs text-center mt-2">
          Transaction failed. Try increasing slippage.
        </p>
      )}
      
      <FiatSettlementGateway 
        isOpen={isFiatModalOpen}
        onClose={() => setIsFiatModalOpen(false)}
      />
    </div>
  )
}