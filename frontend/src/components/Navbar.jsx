import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect, WalletDropdownLink } from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity, EthBalance } from '@coinbase/onchainkit/identity';

export default function Navbar({ isBlocked }) {
  const { isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  
  // Cari connector
  const metaMaskConnector = connectors.find((c) => c.id === 'injected');
  const walletConnectConnector = connectors.find((c) => c.id === 'walletConnect');

  return (
    <nav className="flex flex-col border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-40">
      <div className="flex justify-between items-center p-6">
        <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500 cursor-default">
          🇮🇩 Santara Protocol
        </div>
        
        <div className="flex gap-3 items-center">
          
          {/* 1. COINBASE SMART WALLET (Main) */}
          <div className={`transition-all duration-300 ${isBlocked ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
             <Wallet>
                <ConnectWallet className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-4 py-2 transition-colors">
                  <Avatar className="h-6 w-6" />
                  <Name className="ml-2" />
                </ConnectWallet>
                <WalletDropdown>
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <Avatar /><Name /><Address /><EthBalance />
                  </Identity>
                  <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com">Wallet Settings</WalletDropdownLink>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
             </Wallet>
          </div>

          {/* 2. OPSIONAL: WALLET LAIN (Hanya muncul jika belum connect) */}
          {!isConnected && (
            <div className="flex gap-2">
                
                {/* Tombol WalletConnect (Mobile) */}
                {walletConnectConnector && (
                    <button
                        onClick={() => connect({ connector: walletConnectConnector })}
                        className="flex items-center justify-center w-10 h-10 border border-gray-700 rounded-xl hover:bg-white/10 transition text-xl"
                        title="Scan QR (TrustWallet/Rainbow)"
                    >
                        📱
                    </button>
                )}

                {/* Tombol MetaMask (Desktop) */}
                {metaMaskConnector && (
                    <button
                        onClick={() => connect({ connector: metaMaskConnector })}
                        className={`hidden md:flex items-center gap-2 text-xs border px-3 py-2 rounded-xl font-bold transition-all ${
                            isBlocked 
                            ? 'bg-orange-900/20 text-orange-400 border-orange-500 animate-pulse' 
                            : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                        }`}
                    >
                        🦊 <span className="hidden lg:inline">MetaMask</span>
                    </button>
                )}
            </div>
          )}

        </div>
      </div>
    </nav>
  );
}