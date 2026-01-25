import { useState } from 'react'
import { useAccount } from 'wagmi'
import { 
  LayoutGrid,      // Home
  ArrowRightLeft,  // Swap
  Vault,           // Vault
  Banknote,        // Redeem
  Wallet
} from 'lucide-react'

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
  
  //Tab Button
  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`
        flex-shrink-0
        whitespace-nowrap
        px-3 py-2 
        text-xs 
        md:px-5 md:py-2.5 
        md:text-sm
        rounded-full
        font-semibold
        transition-all duration-300
        flex items-center justify-center gap-1.5 md:gap-2
        border
        ${
          activeTab === id
            ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30'
            : 'bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-gray-800'
        }
      `}
    >
      <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeTab === id ? 'text-white' : 'text-gray-500'}`} />
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white font-sans selection:bg-blue-500/30 pb-20">

      {/* ALERT */}
      {showIndoAlert && (
        <IndoAlert onRetry={checkConnection} isChecking={isChecking} />
      )}

      {/* NAVBAR */}
      <Navbar isBlocked={isBlocked} />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

        {/* ================= NAVIGATION BAR (Mobile & Desktop Unified Style) ================= */}
        <div className="flex justify-center mb-8 relative z-10">
          <div className="
            overflow-x-auto 
            overflow-y-hidden 
            touch-pan-x 
            no-scrollbar
            w-full
            flex justify-center
          ">
            <div className="
              flex 
              gap-1
              md:gap-1.5
              p-1.5 
              bg-[#12141a] 
              border border-gray-800 
              rounded-full 
              shadow-2xl
              max-w-full
            ">
              <TabButton id="home" label="Home" icon={LayoutGrid} />
              <TabButton id="swap" label="Swap" icon={ArrowRightLeft} />
              <TabButton id="vault" label="Vault" icon={Vault} />
              <TabButton id="redeem" label="Redeem" icon={Banknote} />
            </div>
          </div>
        </div>

        {/* ================= CONTENT AREA ================= */}
        <div
          className={`transition-all duration-500 ${
            showIndoAlert
              ? 'opacity-50 grayscale pointer-events-none blur-sm'
              : 'opacity-100'
          }`}
        >
          {activeTab === 'home' && (
             <div className="animate-in fade-in zoom-in-95 duration-300">
                <HomeView setTab={setActiveTab} />
             </div>
          )}
          
          <div className="mx-auto w-full max-w-sm sm:max-w-md">
            {activeTab === 'swap' && (
              <div className="animate-in slide-in-from-bottom-4 duration-300">
                <SwapCard />
              </div>
            )}
            
            {activeTab === 'vault' && (
              <div className="animate-in slide-in-from-bottom-4 duration-300">
                <VaultCard />
              </div>
            )}
            
            {activeTab === 'redeem' && (
              <div className="animate-in slide-in-from-bottom-4 duration-300">
                <RedeemCard />
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}

export default App