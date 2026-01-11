require("dotenv").config();
const hre = require("hardhat");
const { ethers, upgrades } = hre;

async function main() {
  console.log("🔵 --- STARTING DEPLOYMENT ON BASE SEPOLIA (UPGRADEABLE) ---");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Wallet:", deployer.address);
  
  // --------------------------------------------------------
  // 1. Deploy NexusToken (NXS) - Upgradeable
  // --------------------------------------------------------
  console.log("\n[1/2] Deploying NexusToken (NXS) Proxy...");

  const NXS = await ethers.getContractFactory("NexusToken");
  
  // Initialize tanpa argumen (supply awal 0, mint manual nanti)
  const nxs = await upgrades.deployProxy(NXS, [], { 
    initializer: 'initialize',
    kind: 'transparent' 
  });
  await nxs.waitForDeployment();

  const nxsAddr = await nxs.getAddress();
  console.log(`✅ Nexus Token (Proxy) Deployed at: ${nxsAddr}`);

  // --------------------------------------------------------
  // 2. Setup Roles (PENTING)
  // --------------------------------------------------------
  console.log("\n[2/2] Granting Roles...");

  // --- A. Setup Roles di Token NXS ---
  // Kita beri akses MINTER ke Deployer agar bisa mint supply awal
  const MINTER_ROLE = await nxs.MINTER_ROLE();
  const PAUSER_ROLE_NXS = await nxs.PAUSER_ROLE();
  
  await (await nxs.grantRole(PAUSER_ROLE_NXS, deployer.address)).wait();
  console.log(`   > NXS: Pauser Role granted to Relayer`);

  console.log("\n🎉 --- DEPLOYMENT SUCCESSFUL ---");
  console.log("----------------------------------------------------");
  console.log(`NXS_PROXY:   ${nxsAddr}`);
  console.log("----------------------------------------------------");
  console.log("⚠️  NEXT STEP: Mint Supply Awal NXS Manual!");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});