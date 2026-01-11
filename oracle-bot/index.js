// Ganti require('dotenv').config() jadi ini:
import 'dotenv/config'; 

// Ganti const ... = require(...) jadi import ... from ...
import { ethers } from "ethers";
import axios from "axios";
import fs from "fs";

// --- CONFIG ---
// Mengakses env tetap sama
const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const API_URL = process.env.API_URL || "https://indodax.com/api/ticker/ethidr"; // Fallback URL

const KEYSTORE_PATH = process.env.KEYSTORE_PATH;
const KEYSTORE_PASS = process.env.KEYSTORE_PASSWORD;

const ABI = [
    "function updateEthToIdrPrice(uint256 newPrice) external"
];

const MIN_PRICE = 10_000_000;
const MAX_PRICE = 200_000_000;

let oracleWallet = null;

async function getWallet() {
    if (oracleWallet) return oracleWallet;

    console.log("🔐 Decrypting Wallet Keystore...");
    try {
        // fs.readFileSync tetap aman dipakai di ESM
        const jsonContent = fs.readFileSync(KEYSTORE_PATH, 'utf8');
        
        const wallet = await ethers.Wallet.fromEncryptedJson(jsonContent, KEYSTORE_PASS);
        
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        oracleWallet = wallet.connect(provider);
        
        console.log(`✅ Wallet Unlocked: ${oracleWallet.address}`);
        return oracleWallet;

    } catch (error) {
        console.error("❌ Gagal membuka Keystore (Password Salah/File Hilang?)");
        console.error(error.message);
        process.exit(1);
    }
}

async function updatePrice() {
    console.log(`\n[${new Date().toISOString()}] 🤖 Bot Oracle (Indodax) Checking...`);

    try {
        const response = await axios.get(API_URL);
        const rateInteger = parseInt(response.data.ticker.last, 10);

        console.log(`🇮🇩 Indodax Price: 1 ETH = Rp ${rateInteger.toLocaleString()}`);

        if (isNaN(rateInteger) || rateInteger < MIN_PRICE || rateInteger > MAX_PRICE) {
            console.error(`⚠️ HARGA TIDAK WAJAR! Skip update.`);
            return;
        }

        const wallet = await getWallet();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

        console.log(`📡 Sending update tx...`);
        const tx = await contract.updateEthToIdrPrice(rateInteger);
        
        console.log(`⏳ Tx Hash: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ SUKSES! Harga terupdate.`);

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

// Eksekusi
getWallet().then(() => {
    updatePrice();
    setInterval(updatePrice, 900000);
});