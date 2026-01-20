import React from 'react';

export default function IndoAlert({ onRetry, isChecking }) {
  return (
    <div className="bg-red-900/95 border-b border-red-500 sticky top-0 z-50 shadow-2xl backdrop-blur-md transition-all duration-300">
      <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Pesan Kiri */}
        <div className="flex gap-4 items-center">
          <div className="bg-red-950 p-2 rounded-full border border-red-500/50 animate-pulse">
            🚫
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">
              Akses Smart Wallet Terblokir ISP
            </h3>
            <p className="text-red-200 text-xs mt-1 max-w-xl">
              Domain Coinbase tidak dapat diakses. Mohon aktifkan <strong>VPN</strong> atau ganti DNS ke 
              <strong> 1.1.1.1 (Cloudflare)</strong> / <strong>8.8.8.8 (Google)</strong> agar fitur berjalan.
            </p>
          </div>
        </div>

        {/* Tombol Kanan */}
        <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
                onClick={onRetry}
                disabled={isChecking}
                className="text-xs bg-white text-red-900 font-bold px-4 py-2 rounded hover:bg-gray-200 transition flex gap-2 items-center justify-center w-full md:w-auto disabled:opacity-70"
            >
                {isChecking ? 'Mengecek...' : '🔄 Cek Koneksi'}
            </button>
            <a 
                href="https://developers.cloudflare.com/1.1.1.1/setup/" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-white underline hover:text-red-200 whitespace-nowrap"
            >
                Panduan DNS
            </a>
        </div>
      </div>
    </div>
  );
}