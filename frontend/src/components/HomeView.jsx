import React from 'react';

export default function HomeView({ setTab }) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Hero Section */}
      <div className="text-center space-y-4 py-10">
        <h1 className="text-5xl md:text-7xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-orange-500 tracking-tight pb-2">
          Santara Protocol
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
          Ekosistem Rupiah Digital di Base Sepolia Chain.<br/>
          <span className="text-gray-500 text-sm">Saving. Yielding. Spending.</span>
        </p>
      </div>

      {/* Menu Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        
        {/* Card 1: Swap */}
        <div 
          onClick={() => setTab('swap')}
          className="glass-card rounded-3xl p-8 cursor-pointer hover:border-blue-500/50 hover:bg-blue-900/10 transition-all group"
        >
          <div className="bg-blue-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
            💱
          </div>
          <h3 className="text-xl font-bold text-white mb-2">1. Get IDRX</h3>
          <p className="text-gray-400 text-sm">
            Tukar ETH atau wSAN Anda menjadi Rupiah Digital (IDRX) secara instan.
          </p>
        </div>

        {/* Card 2: Vault */}
        <div 
          onClick={() => setTab('vault')}
          className="glass-card rounded-3xl p-8 cursor-pointer hover:border-purple-500/50 hover:bg-purple-900/10 transition-all group"
        >
          <div className="bg-purple-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
            🏦
          </div>
          <h3 className="text-xl font-bold text-white mb-2">2. Earn Yield</h3>
          <p className="text-gray-400 text-sm">
            Simpan IDRX di Vault dan dapatkan bunga pasif dalam bentuk token NXS.
          </p>
        </div>

        {/* Card 3: Redeem */}
        <div 
          onClick={() => setTab('redeem')}
          className="glass-card rounded-3xl p-8 cursor-pointer hover:border-orange-500/50 hover:bg-orange-900/10 transition-all group"
        >
          <div className="bg-orange-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
            🔥
          </div>
          <h3 className="text-xl font-bold text-white mb-2">3. Cash Out</h3>
          <p className="text-gray-400 text-sm">
            Tukar hasil panen NXS Anda menjadi USDC kapan saja.
          </p>
        </div>

      </div>
    </div>
  );
}