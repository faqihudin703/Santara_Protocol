import React from 'react';
import { ShieldAlert, RefreshCw, ExternalLink, GlobeLock } from 'lucide-react';

export default function IndoAlert({ onRetry, isChecking }) {
  return (
    <div className="bg-[#2a0b0b]/95 border-b border-red-900/50 sticky top-0 z-[100] backdrop-blur-xl transition-all duration-300 font-sans">
      <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* MESSAGE SECTION */}
        <div className="flex gap-4 items-start md:items-center">
          
          {/* Icon Box */}
          <div className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20 shrink-0 relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-xl animate-ping opacity-75"></div>
            <GlobeLock className="w-5 h-5 text-red-500 relative z-10" />
          </div>

          <div>
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              Koneksi Smart Wallet Terblokir
              <span className="hidden md:inline-block px-2 py-0.5 rounded text-[10px] bg-red-900/40 text-red-300 border border-red-500/20">
                ISP RESTRICTION
              </span>
            </h3>
            <p className="text-red-200/80 text-xs mt-1 leading-relaxed max-w-2xl">
              Akses ke domain Coinbase/Base diblokir oleh Provider Internet Anda. 
              Mohon aktifkan <span className="text-white font-bold">VPN</span> atau gunakan DNS 
              <span className="text-white font-mono bg-red-900/30 px-1 rounded mx-1">1.1.1.1</span> 
              agar aplikasi berjalan normal.
            </p>
          </div>
        </div>

        {/* ACTION SECTION */}
        <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
            
            {/* Guide Link */}
            <a 
                href="https://developers.cloudflare.com/1.1.1.1/setup/" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-red-300 hover:text-white transition flex items-center gap-1.5 whitespace-nowrap px-3 py-2"
            >
                Panduan DNS <ExternalLink className="w-3 h-3" />
            </a>

            {/* Retry Button */}
            <button 
                onClick={onRetry}
                disabled={isChecking}
                className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2.5 rounded-lg transition shadow-lg shadow-red-900/20 flex gap-2 items-center justify-center w-full md:w-auto disabled:opacity-70 disabled:cursor-not-allowed border border-red-500"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Mengecek...' : 'Cek Koneksi'}
            </button>
        </div>

      </div>
    </div>
  );
}