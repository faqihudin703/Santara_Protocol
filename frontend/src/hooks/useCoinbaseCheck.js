import { useState, useEffect } from 'react';

export function useCoinbaseCheck() {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkConnection = async () => {
    setIsChecking(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout 3 detik

    try {
      // Coba ping domain wallet coinbase
      // mode: 'no-cors' wajib agar tidak error CORS (kita cuma butuh status sukses/gagal network)
      await fetch('https://wallet.coinbase.com', { 
        mode: 'no-cors', 
        signal: controller.signal 
      });
      
      // Jika code sampai sini, berarti DNS tembus
      setIsBlocked(false);
      console.log("✅ Koneksi Coinbase Aman");
    } catch (error) {
      // Jika error Network/Timeout, asumsi kena blokir Kominfo
      console.warn("⚠️ Koneksi Coinbase Terblokir:", error);
      setIsBlocked(true);
    } finally {
      clearTimeout(timeoutId);
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Cek saat pertama load
    checkConnection();

    // Auto-retry setiap 10 detik (siapa tahu user baru nyalain VPN)
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  return { isBlocked, isChecking, checkConnection };
}