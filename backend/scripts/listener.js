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

  // Health check: verify RPC connection
  try {
    const testProvider = new ethers.JsonRpcProvider(RPC_URL);
    const blockNumber = await testProvider.getBlockNumber();
    console.log(`✓ RPC connection verified (block: ${blockNumber})`);
  } catch (error) {
    console.error("✗ RPC health check failed:", error.message);
    throw new Error("Cannot connect to RPC. Please check RPC_URL.");
  }

  let provider;
  let contract;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_DELAY = 5000; // 5 seconds

  async function connect() {
    try {
      provider = new ethers.JsonRpcProvider(RPC_URL);
      
      // Test connection
      await provider.getBlockNumber();
      console.log("✓ RPC connection successful");
      
      contract = new ethers.Contract(contractAddress, abi, provider);
      
      // Set up event listener with error handling
      contract.on("IntentPublished", async (intentId, user, message, category, cid, timestamp, event) => {
        try {
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
        } catch (error) {
          console.error("Error processing IntentPublished event:", error.message);
          // Don't throw - continue listening
        }
      });

      // Handle connection errors
      provider.on("error", (error) => {
        console.error("Provider error:", error.message);
        handleReconnect();
      });

      // Also fetch existing intents on startup (using pagination for efficiency)
      console.log("Fetching existing intents...");
      try {
        const intentCount = await contract.getIntentCount();
        const totalCount = Number(intentCount);
        console.log(`Found ${totalCount} existing intent(s)`);
        
        if (totalCount > 0) {
          // Use pagination to avoid gas issues
          const PAGE_SIZE = 50;
          let processedCount = 0;
          
          for (let offset = 0; offset < totalCount; offset += PAGE_SIZE) {
            try {
              const page = await contract.getIntentsPaginated(offset, PAGE_SIZE);
              
              for (let i = 0; i < page.length; i++) {
                try {
                  const intent = page[i];
                  const intentData = {
                    intentId: (offset + i).toString(),
                    user: intent.user,
                    message: intent.message,
                    category: intent.category,
                    cid: intent.cid,
                    timestamp: intent.timestamp.toString(),
                    blockNumber: "unknown"
                  };
                  addIntentCallback(intentData);
                  processedCount++;
                } catch (error) {
                  console.error(`Error processing intent ${offset + i}:`, error.message);
                  // Continue with next intent
                }
              }
            } catch (error) {
              console.error(`Error fetching page at offset ${offset}:`, error.message);
              // Continue with next page
            }
          }
          
          console.log(`✓ Processed ${processedCount} existing intent(s)`);
        }
      } catch (error) {
        console.error("Error fetching existing intents:", error.message);
        // Continue anyway - listener will catch new events
      }

      console.log("✓ Listener started. Waiting for events...");
      reconnectAttempts = 0; // Reset on successful connection
      
    } catch (error) {
      console.error("Connection error:", error.message);
      handleReconnect();
    }
  }

  async function handleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`✗ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping listener.`);
      return;
    }

    reconnectAttempts++;
    console.log(`Attempting to reconnect... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    
    // Remove old listeners
    if (contract) {
      contract.removeAllListeners("IntentPublished");
    }
    if (provider) {
      provider.removeAllListeners("error");
    }

    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
    
    // Reconnect
    await connect();
  }

  // Initial connection
  await connect();
}

module.exports = { startListener };

