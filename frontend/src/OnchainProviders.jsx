import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { baseSepolia } from 'viem/chains';
import { WagmiProvider, createConfig, http } from 'wagmi';
// Import walletConnect di sini
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'; 

// Ambil Project ID dari env
const projectId = import.meta.env.VITE_WC_PROJECT_ID || 'project_id_random_sementara';

const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    // 1. Coinbase (Prioritas Utama)
    coinbaseWallet({
      appName: 'Santara Protocol',
      preference: 'smartWalletOnly',
    }),
    // 2. WalletConnect (TrustWallet, Rainbow, Mobile Apps)
    walletConnect({ 
      projectId, 
      metadata: {
        name: 'Santara Protocol',
        description: 'Yield-bearing Rupiah Ecosystem',
        url: 'https://base-dapps.serverfaqih.my.id',
        icons: ['https://avatars.githubusercontent.com/u/37784886']
      },
      showQrModal: true // Agar muncul QR Code otomatis
    }),
    // 3. MetaMask (Fallback Desktop)
    injected(), 
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
});

const queryClient = new QueryClient();

export function OnchainProviders({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={import.meta.env.VITE_CDP_API_KEY}
          chain={baseSepolia}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}