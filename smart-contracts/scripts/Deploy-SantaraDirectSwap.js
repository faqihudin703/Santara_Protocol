const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying with account:", deployer.address);

  // --- CONFIG ADDRESSES (PASTIKAN BENAR) ---
  const WSAN_ADDRESS = "0x...."; // Address wSAN
  const DEX_ADDRESS  = "0x...."; // Address DEX
  const IDRX_ADDRESS = "0x...."; // Address IDRXStablecoin
  
  const ORACLE_WALLET_ADDRESS = "0x....";

  console.log("----------------------------------------------------");
  console.log("📦 Preparing SantaraDirectSwap (Enterprise Version)...");

  const SantaraSwap = await ethers.getContractFactory("SantaraDirectSwap");

  // Argumen Initialize:
  // 1. _wSan, 2. _idrx, 3. _dex, 
  // 4. admin, 5. oracle, 6. treasury
  // Kita set admin, oracle, treasury ke Deployer semua biar simpel demo-nya
  const args = [
    WSAN_ADDRESS,
    IDRX_ADDRESS,
    DEX_ADDRESS,
    deployer.address, // Admin
    ORACLE_WALLET_ADDRESS, // Oracle
    deployer.address  // Treasury
  ];

  const swapProxy = await upgrades.deployProxy(SantaraSwap, args, { 
    initializer: 'initialize' 
  });

  console.log("⏳ Waiting for deployment...");
  await swapProxy.waitForDeployment();

  const address = await swapProxy.getAddress();
  console.log("----------------------------------------------------");
  console.log(`✅ SantaraDirectSwap Deployed at: ${address}`);
  console.log("----------------------------------------------------");
  
  console.log("⚠️ NEXT STEP: Kirim saldo IDRX ke kontrak ini sekarang!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});