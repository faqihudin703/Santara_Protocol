const hre = require("hardhat");

async function main() {
  // GANTI dengan address token IDRX
  const IDRX_TOKEN = "0x....";

  const Gateway = await hre.ethers.getContractFactory(
    "SantaraFiatSettlementGateway"
  );

  const gateway = await Gateway.deploy(IDRX_TOKEN);
  await gateway.waitForDeployment();

  console.log("SantaraFiatSettlementGateway deployed at:");
  console.log(await gateway.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});