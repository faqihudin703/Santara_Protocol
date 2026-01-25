import React from 'react';
import { ArrowRightLeft, Vault, Banknote, ArrowRight } from 'lucide-react';

export default function HomeView({ setTab }) {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 py-6">
      
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/20 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          Live on Base Sepolia
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-tight">
          Santara <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">Protocol</span>
        </h1>
        
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
          The <span className="text-white font-semibold">Digital Rupiah Ecosystem</span> on Base Sepolia Chain.
          <br className="hidden md:block" />
          <span className="font-mono text-blue-400 mt-2 block text-sm md:text-base">
            Saving. Yielding. Spending.
          </span>
        </p>
      </div>

      {/* Menu Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4">
        
        {/* Card 1: Swap */}
        <div 
          onClick={() => setTab('swap')}
          className="bg-[#12141a] border border-gray-800 rounded-3xl p-8 cursor-pointer hover:border-blue-500/50 hover:bg-blue-900/5 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-125 transition-transform duration-500">
             <ArrowRightLeft className="w-32 h-32" />
          </div>

          <div className="bg-blue-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-blue-500/20">
            <ArrowRightLeft className="w-7 h-7 text-blue-400" />
          </div>
          
          <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            1. Get IDRX 
            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-500" />
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Swap your <span className="text-gray-200 font-mono">ETH</span> or <span className="text-gray-200 font-mono">wSAN</span> into Digital Rupiah (IDRX) instantly
          </p>
        </div>

        {/* Card 2: Vault */}
        <div 
          onClick={() => setTab('vault')}
          className="bg-[#12141a] border border-gray-800 rounded-3xl p-8 cursor-pointer hover:border-purple-500/50 hover:bg-purple-900/5 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-125 transition-transform duration-500">
             <Vault className="w-32 h-32" />
          </div>

          <div className="bg-purple-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-purple-500/20">
            <Vault className="w-7 h-7 text-purple-400" />
          </div>
          
          <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            2. Earn Yield
            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-purple-500" />
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Deposit IDRX into the Vault and earn passive interest in <span className="text-gray-200 font-mono">NXS</span> tokens.
          </p>
        </div>

        {/* Card 3: Redeem */}
        <div 
          onClick={() => setTab('redeem')}
          className="bg-[#12141a] border border-gray-800 rounded-3xl p-8 cursor-pointer hover:border-orange-500/50 hover:bg-orange-900/5 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-125 transition-transform duration-500">
             <Banknote className="w-32 h-32" />
          </div>

          <div className="bg-orange-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-orange-500/20">
            <Banknote className="w-7 h-7 text-orange-400" />
          </div>
          
          <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            3. Cash Out
            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-orange-500" />
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Redeem your NXS rewards into <span className="text-gray-200 font-mono">USDC</span> anytime.
          </p>
        </div>

      </div>
    </div>
  );
}