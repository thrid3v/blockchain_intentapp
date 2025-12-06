const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const IntentRegistry = await hre.ethers.getContractFactory("IntentRegistry");
  const intentRegistry = await IntentRegistry.deploy();

  await intentRegistry.waitForDeployment();

  const address = await intentRegistry.getAddress();
  console.log("IntentRegistry deployed to:", address);

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    address: address,
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  const deploymentsDir = __dirname + "/../deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    deploymentsDir + `/IntentRegistry-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment info saved to deployments/IntentRegistry-" + hre.network.name + ".json");
  
  // Copy ABI to frontend
  try {
    const artifactPath = __dirname + "/../artifacts/contracts/IntentRegistry.sol/IntentRegistry.json";
    const frontendABIPath = __dirname + "/../../frontend/abi/IntentRegistry.json";
    
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const abiDir = __dirname + "/../../frontend/abi";
      if (!fs.existsSync(abiDir)) {
        fs.mkdirSync(abiDir, { recursive: true });
      }
      fs.writeFileSync(frontendABIPath, JSON.stringify(artifact.abi, null, 2));
      console.log("ABI copied to frontend/abi/IntentRegistry.json");
    }
  } catch (error) {
    console.warn("Could not copy ABI to frontend:", error.message);
  }
  
  console.log("\nCopy this address to your frontend/.env.local and backend/.env:");
  console.log("NEXT_PUBLIC_CONTRACT_ADDRESS=" + address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

