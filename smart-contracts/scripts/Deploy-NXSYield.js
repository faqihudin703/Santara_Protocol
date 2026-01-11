const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying Vault with Existing NXS...");
  console.log("Account:", deployer.address);

  // --- 1. CONFIG ADDRESS (ISI DENGAN BENAR) ---
  const NXS_ADDRESS = "0x....";
  const IDRX_ADDRESS  = "0x....";
  
  // Cek apakah alamat valid
  if (!IDRX_ADDRESS || !NXS_ADDRESS) {
    console.error("❌ Error: Harap isi IDRX_ADDRESS dan NXS_ADDRESS di script!");
    process.exit(1);
  }

  // --- 2. DEPLOY VAULT ---
  console.log("\n🏦 Deploying NXSYieldVault...");
  const Vault = await ethers.getContractFactory("NXSYieldVault");

  // initialize(stakingToken, rewardsToken)
  // Argumen: IDRX (untuk deposit), NXS Lama (untuk reward)
  const vaultProxy = await upgrades.deployProxy(Vault, [IDRX_ADDRESS, NXS_ADDRESS], {
    initializer: 'initialize',
  });

  console.log("⏳ Waiting for deployment...");
  await vaultProxy.waitForDeployment();
  
  const vaultAddress = await vaultProxy.getAddress();
  
  console.log("----------------------------------------------------");
  console.log(`✅ NXSYieldVault Deployed at: ${vaultAddress}`);
  console.log("----------------------------------------------------");
  
  console.log("⚠️ NEXT STEPS (FUNDING REWARD):");
  console.log("Karena ini token lama, Anda harus isi saldo NXS ke Vault ini agar user bisa panen bunga.");
  console.log("Caranya:");
  console.log("1. Buka Contract NXS Lama di Remix/Etherscan.");
  console.log(`2. Panggil fungsi 'mint(${vaultAddress}, 1000000000000000000000)' (1000 NXS).`);
  console.log("   (Pastikan wallet Anda punya role MINTER_ROLE di kontrak lama).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});