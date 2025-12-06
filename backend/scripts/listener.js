const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load contract ABI
function loadABI() {
  try {
    // Try to load from Hardhat artifacts
    const artifactPath = path.join(__dirname, "../../contracts/artifacts/contracts/IntentRegistry.sol/IntentRegistry.json");
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      return artifact.abi;
    }
    
    // Fallback: try frontend ABI
    const frontendABIPath = path.join(__dirname, "../../frontend/abi/IntentRegistry.json");
    if (fs.existsSync(frontendABIPath)) {
      return JSON.parse(fs.readFileSync(frontendABIPath, "utf8"));
    }
    
    throw new Error("ABI not found. Please compile contracts first.");
  } catch (error) {
    console.error("Error loading ABI:", error.message);
    throw error;
  }
}

// Load contract address
function loadContractAddress() {
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    // Try to load from deployment file
    try {
      const deploymentPath = path.join(__dirname, "../../contracts/deployments/IntentRegistry-localhost.json");
      if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        return deployment.address;
      }
    } catch (error) {
      console.warn("Could not load from deployment file:", error.message);
    }
    
    throw new Error("CONTRACT_ADDRESS not set. Please set it in .env or deploy the contract first.");
  }
  
  return contractAddress;
}

async function startListener(addIntentCallback) {
  const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
  const contractAddress = loadContractAddress();
  const abi = loadABI();

  console.log("Connecting to RPC:", RPC_URL);
  console.log("Contract address:", contractAddress);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(contractAddress, abi, provider);

  // Listen for new events
  contract.on("IntentPublished", async (intentId, user, message, category, cid, timestamp, event) => {
    console.log("\n=== New Intent Published ===");
    console.log("Intent ID:", intentId.toString());
    console.log("User:", user);
    console.log("Message:", message);
    console.log("Category:", category);
    console.log("CID:", cid);
    console.log("Timestamp:", timestamp.toString());
    console.log("Block:", event.log.blockNumber);

    const intent = {
      intentId: intentId.toString(),
      user: user,
      message: message,
      category: category,
      cid: cid,
      timestamp: timestamp.toString(),
      blockNumber: event.log.blockNumber.toString(),
      txHash: event.log.transactionHash
    };

    addIntentCallback(intent);
  });

  // Also fetch existing intents on startup
  console.log("Fetching existing intents...");
  try {
    const allIntents = await contract.getAllIntents();
    console.log(`Found ${allIntents.length} existing intent(s)`);
    
    for (let i = 0; i < allIntents.length; i++) {
      const intent = allIntents[i];
      const intentData = {
        intentId: i.toString(),
        user: intent.user,
        message: intent.message,
        category: intent.category,
        cid: intent.cid,
        timestamp: intent.timestamp.toString(),
        blockNumber: "unknown"
      };
      addIntentCallback(intentData);
    }
  } catch (error) {
    console.error("Error fetching existing intents:", error.message);
  }

  console.log("Listener started. Waiting for events...");
}

module.exports = { startListener };

