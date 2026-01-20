const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying NXSRedemption with account:", deployer.address);

  // --- 1. KONFIGURASI ALAMAT ---
  // Masukkan Alamat Token NXS (Nexus) Anda
  const NXS_ADDRESS  = "0x...."; 
  
  // Alamat USDC Asli di Base Sepolia
  const USDC_ADDRESS = "0x....";

  // --- 2. KONFIGURASI HARGA (RATE) ---
  // Strategi: 1 NXS = $0.02 (2 Sen)
  // Perhitungan: 0.02 * 1,000,000 (USDC Decimals) = 20,000
  const INITIAL_RATE = "20000"; 

  console.log(`💲 Initial Rate set to: ${INITIAL_RATE} ($0.02 per NXS)`);

  // --- 3. DEPLOY ---
  const Redemption = await ethers.getContractFactory("NXSRedemption");

  // initialize(nxs, usdc, rate)
  const proxy = await upgrades.deployProxy(Redemption, [
    NXS_ADDRESS, 
    USDC_ADDRESS, 
    INITIAL_RATE
  ], { 
    initializer: 'initialize',
    kind: "transparent"
  });

  console.log("⏳ Waiting for deployment...");
  await proxy.waitForDeployment();
  const address = await proxy.getAddress();

  console.log("----------------------------------------------------");
  console.log(`✅ NXSRedemption Deployed at: ${address}`);
  console.log("----------------------------------------------------");
  
  console.log("⚠️ NEXT STEPS (FUNDING):");
  console.log("1. Buka Uniswap (Base Sepolia).");
  console.log("2. Swap 2 ETH Testnet -> USDC (~$6,000).");
  console.log(`3. Transfer semua USDC tersebut ke contract: ${address}`);
  console.log("4. Kontrak siap melayani redeem user!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});