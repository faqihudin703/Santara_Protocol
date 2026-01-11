const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment for IDRXStablecoin...");

  // 1. Ambil Contract Factory
  const IDRX = await hre.ethers.getContractFactory("IDRXStablecoin");

  // 2. Eksekusi Deploy
  // (Tidak butuh argumen constructor karena hardcoded di Solidity)
  const idrx = await IDRX.deploy();

  console.log("⏳ Waiting for deployment...");
  await idrx.waitForDeployment();

  const address = await idrx.getAddress();
  console.log("----------------------------------------------------");
  console.log(`✅ IDRXStablecoin deployed to: ${address}`);
  console.log("----------------------------------------------------");
}

// Pattern wajib untuk handle async/error
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});