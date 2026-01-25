import { useAccount, useConnect } from 'wagmi';
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect, WalletDropdownLink } from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity, EthBalance } from '@coinbase/onchainkit/identity';
import { QrCode, Wallet as WalletIcon, Zap } from 'lucide-react';

export default function Navbar({ isBlocked }) {
  const { isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  
  const metaMaskConnector = connectors.find((c) => c.id === 'injected');
  const walletConnectConnector = connectors.find((c) => c.id === 'walletConnect');

  return (
    <nav className="flex flex-col border-b border-gray-800 bg-[#0a0b0d]/80 backdrop-blur-xl sticky top-0 z-40 transition-all">
      <div className="flex justify-between items-center px-4 py-4 md:px-6">
        
        {/* 1. BRAND LOGO & TAGLINE */}
        <div className="flex items-center gap-3 cursor-default group">
          
          {/* Logo Icon */}
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 group-hover:scale-105 transition duration-300 shrink-0">
             <img src="../santara-logo.svg" alt="Santara Logo" className="w-8 h-8" />
          </div>
          
          <div className="flex flex-col justify-center">
             <span className="text-lg md:text-xl font-bold text-white tracking-tight leading-none mb-0.5">
               Santara Protocol
             </span>
          </div>
        </div>
        
        {/* 2. WALLET ACTIONS */}
        <div className="flex gap-3 items-center">
          
          {/* COINBASE SMART WALLET */}
          <div className={`transition-all duration-300 ${isBlocked ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
             <Wallet>
                <ConnectWallet className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl px-4 py-2.5 transition shadow-lg shadow-blue-900/20 border border-blue-500/50">
                  <Avatar className="h-6 w-6 rounded-full bg-blue-800" />
                  <Name className="ml-2 font-sans font-medium" />
                </ConnectWallet>
                
                <WalletDropdown className="bg-[#12141a] border border-gray-800 rounded-xl shadow-2xl p-2">
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <Avatar />
                    <Name className="text-white font-bold" />
                    <Address className="text-gray-400 font-mono text-xs" />
                    <EthBalance className="text-gray-300 font-mono font-bold" />
                  </Identity>
                  <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com" className="hover:bg-gray-800 rounded-lg text-gray-300">
                    Wallet Settings
                  </WalletDropdownLink>
                  <WalletDropdownDisconnect className="hover:bg-red-900/20 text-red-400 rounded-lg" />
                </WalletDropdown>
             </Wallet>
          </div>

          {/* ALTERNATIVE WALLETS (Only if disconnected) */}
          {!isConnected && (
            <div className="flex gap-2">
                {/* WalletConnect */}
                {walletConnectConnector && (
                    <button
                        onClick={() => connect({ connector: walletConnectConnector })}
                        className="flex items-center justify-center w-10 h-10 border border-gray-700 bg-[#12141a] rounded-xl hover:bg-gray-800 hover:border-gray-600 transition text-gray-400 hover:text-white"
                        title="Scan QR"
                    >
                        <QrCode className="w-5 h-5" />
                    </button>
                )}
                {/* MetaMask */}
                {metaMaskConnector && (
                    <button
                        onClick={() => connect({ connector: metaMaskConnector })}
                        className={`hidden md:flex items-center gap-2 text-xs border px-4 py-2.5 rounded-xl font-bold transition-all ${
                            isBlocked 
                            ? 'bg-orange-900/10 text-orange-400 border-orange-500/50 animate-pulse' 
                            : 'bg-[#12141a] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800'
                        }`}
                    >
                        <WalletIcon className="w-4 h-4" />
                        <span className="hidden lg:inline">MetaMask</span>
                    </button>
                )}
            </div>
          )}

        </div>
      </div>
    </nav>
  );
}