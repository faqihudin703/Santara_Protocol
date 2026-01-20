import { useState, useMemo, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseUnits, formatEther } from 'viem'
import { CONTRACTS, ABIS } from '../config'

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

  /* ================= AMOUNT ================= */

  const parsedAmount = useMemo(
    () => (amount ? parseUnits(amount, 18) : 0n),
    [amount]
  )

  /* ================= BALANCE ================= */

  const { data: nxsBalance } = useReadContract({
    address: CONTRACTS.NXS,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: [address],
  })

  /* ================= ALLOWANCE ================= */

  const { data: allowance } = useReadContract({
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
      setAmount('')
      setLastAction(null)
    }
  }, [isSuccess])

  /* ================= UI ================= */

  const estimatedUSDC = amount
    ? (parseFloat(amount) * 0.02).toFixed(2)
    : '0.00'

  return (
    <div className="neon-card glow-orange rounded-3xl p-6 h-full flex flex-col justify-between group relative">
      <h2 className="text-xl font-bold text-orange-400 mb-6">
        Cash Out NXS
      </h2>

      <div className="relative mb-4">
        <div className="flex justify-between text-xs text-orange-300 mb-2">
          <span>Enter NXS</span>
          <span>
            Your NXS:{' '}
            <span className="text-white">
              {nxsBalance ? format2(formatEther(nxsBalance)) : '0.0'}
            </span>
          </span>
        </div>

        <input
          type="number"
          placeholder="Enter NXS Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isTxRunning}
          className="cyber-input mb-4 disabled:opacity-50"
        />

        <div className="bg-black/50 p-4 rounded-xl border border-white/5 mb-4">
          <p className="text-xs text-gray-400">
            Estimated USDC
          </p>
          <p className="text-xl font-mono text-white">
            ${estimatedUSDC}
          </p>
        </div>
      </div>

      <button
        onClick={handleAction}
        disabled={!amount || isTxRunning}
        className={`action-btn ${
          isTxRunning
            ? 'bg-gray-700 cursor-not-allowed'
            : needsApproval
            ? 'bg-gray-800 hover:bg-gray-700'
            : 'bg-orange-600 hover:bg-orange-500 shadow-lg shadow-orange-900/30'
        }`}
      >
        {isPending && lastAction === 'approve' && 'Allow NXS...'}
        {isPending && lastAction === 'redeem' && 'Processing cash out...'}
        {isConfirming && 'Confirming...'}
        {!isTxRunning &&
          (needsApproval ? 'Allow NXS' : 'Cash Out NXS')}
      </button>

      {isConfirming && (
        <p className="text-yellow-400 text-xs text-center mt-2">
          Please wait, your transaction is being confirmed...
        </p>
      )}

      {isSuccess && lastAction === 'redeem' && (
        <p className="text-green-400 text-xs text-center mt-2">
          Done! USDC has been sent to your wallet.
        </p>
      )}

      {isSuccess && lastAction === 'approve' && (
        <p className="text-blue-400 text-xs text-center mt-2">
          Permission granted. You can cash out now.
        </p>
      )}

      {isError && (
        <p className="text-red-400 text-xs text-center mt-2">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  )
}