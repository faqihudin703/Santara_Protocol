import { useState } from 'react'
import { useAccount } from 'wagmi'

import Navbar from './components/Navbar'
import IndoAlert from './components/IndoAlert'
import SwapCard from './components/SwapCard'
import VaultCard from './components/VaultCard'
import RedeemCard from './components/RedeemCard'
import HomeView from './components/HomeView'
import { useCoinbaseCheck } from './hooks/useCoinbaseCheck'

function App() {
  const [activeTab, setActiveTab] = useState('home')

  const { isConnected, connector } = useAccount()
  const { isBlocked, isChecking, checkConnection } = useCoinbaseCheck()
  
  const isCoinbase = connector?.id === 'coinbaseWallet' || connector?.name?.toLowerCase().includes('coinbase')

  const showIndoAlert = isBlocked && (!isConnected || isCoinbase)

  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`
        flex-shrink-0
        whitespace-nowrap
        px-5 py-3
        rounded-full
        font-bold
        text-sm
        min-w-[110px]
        transition-all duration-300
        flex items-center justify-center gap-2
        ${
          activeTab === id
            ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }
      `}
    >
      <span>{icon}</span>
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30 pb-20">

      {/* ALERT */}
      {showIndoAlert && (
        <IndoAlert onRetry={checkConnection} isChecking={isChecking} />
      )}

      {/* NAVBAR */}
      <Navbar isBlocked={isBlocked} />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

        {/* ================= MOBILE NAV ================= */}
        <div className="relative mb-8 md:hidden">
          <div className="overflow-x-auto overflow-y-hidden touch-pan-x">
            <div className="
              neon-card
              p-2
              rounded-full
              flex
              gap-2
              min-w-max
              bg-black/40
              border border-white/10
            ">
              <TabButton id="home" label="Home" icon="🏠" />
              <TabButton id="swap" label="Swap" icon="💱" />
              <TabButton id="vault" label="Vault" icon="🏦" />
              <TabButton id="redeem" label="Redeem" icon="🔥" />
            </div>
          </div>
        </div>

        {/* ================= DESKTOP NAV ================= */}
        <div className="relative mb-10 hidden md:flex justify-center">
          <div className="
            neon-card
            p-2
            rounded-full
            flex
            gap-2
            bg-black/40
            border border-white/10
          ">
            <TabButton id="home" label="Home" icon="🏠" />
            <TabButton id="swap" label="Swap" icon="💱" />
            <TabButton id="vault" label="Vault" icon="🏦" />
            <TabButton id="redeem" label="Redeem" icon="🔥" />
          </div>
        </div>

        {/* ================= CONTENT ================= */}
        <div
          className={`transition-all duration-500 ${
            showIndoAlert
              ? 'opacity-50 grayscale pointer-events-none'
              : 'opacity-100'
          }`}
        >
          {activeTab === 'home' && <HomeView setTab={setActiveTab} />}

          <div className="mx-auto w-full max-w-sm sm:max-w-md">
            {activeTab === 'swap' && <SwapCard />}
            {activeTab === 'vault' && <VaultCard />}
            {activeTab === 'redeem' && <RedeemCard />}
          </div>
        </div>

      </main>
    </div>
  )
}

export default App