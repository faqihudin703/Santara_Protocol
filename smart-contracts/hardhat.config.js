require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

const { ethers } = require("ethers");
const fs = require("fs");

// --- Ambil Variabel Konfigurasi ---
const BASE_RPC_URL = process.env.BASE_RPC_URL;
const KEYSTORE_PATH_MAIN = process.env.KEYSTORE_PATH;
const KEYSTORE_PASSWORD_MAIN = process.env.KEYSTORE_PASSWORD;
// Tambahkan variabel untuk API Key Etherscan
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

/**
 * @dev Dekripsi keystore Geth (synchronous) → return private key array
 */
function getPrivateKeyFromKeystore() {
  if (!KEYSTORE_PATH_MAIN || !KEYSTORE_PASSWORD_MAIN) {
    console.warn("⚠️  KEYSTORE_PATH or PASSWORD kosong. Hardhat akan pakai akun default.");
    return [];
  }

  try {
    const keystore = fs.readFileSync(KEYSTORE_PATH_MAIN, "utf8");
    const wallet = ethers.Wallet.fromEncryptedJsonSync(keystore, KEYSTORE_PASSWORD_MAIN);
    return [wallet.privateKey];
  } catch (e) {
    console.error(`❌ Gagal decrypt keystore (${KEYSTORE_PATH_MAIN})`);
    console.error(e.message);
    return [];
  }
}

const deployerAccounts = getPrivateKeyFromKeystore();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris" 
    }
  },

  networks: {
    hardhat: {
      chainId: 1337,
    },
    
    base: {
      url: BASE_RPC_URL || "",
      chainId: 84532,
      accounts: deployerAccounts,
    },
  },

  // --- Konfigurasi Verifikasi ---
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,  // satu key untuk semua network
    customChains: [
      {
        network: "base",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api", 
          browserURL: "https://sepolia.basescan.org"
        },
      }
    ]
  },
  
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify.dev/server"
  }
};