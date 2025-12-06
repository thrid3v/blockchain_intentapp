import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { fetchFromIPFS } from "../utils/ipfs";

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      send: (method: string, params?: any[]) => Promise<any>;
    };
  }
}

// Contract ABI (minimal for what we need)
const INTENT_REGISTRY_ABI = [
  "function publishIntent(string memory message, string memory category, string memory cid) public",
  "function getAllIntents() public view returns (tuple(address user, string message, string category, string cid, uint256 timestamp)[])",
  "function getIntentsPaginated(uint256 offset, uint256 limit) public view returns (tuple(address user, string message, string category, string cid, uint256 timestamp)[])",
  "function getIntentCount() public view returns (uint256)",
  "event IntentPublished(uint256 indexed intentId, address indexed user, string message, string category, string cid, uint256 timestamp)"
];

export default function Home() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string>("");
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [intents, setIntents] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingIntents, setLoadingIntents] = useState(false);
  const [networkError, setNetworkError] = useState<string>("");
  const [txStatus, setTxStatus] = useState<{hash?: string, status?: "pending" | "success" | "error", message?: string}>({});
  const switchingNetworkRef = useRef(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [budget, setBudget] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const EXPECTED_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID) : 31337;
  const MUMBAI_RPC_URL = process.env.NEXT_PUBLIC_MUMBAI_RPC_URL || "";
  const AMOY_RPC_URL = process.env.NEXT_PUBLIC_AMOY_RPC_URL || "";

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
  
  // Support both Mumbai (80001) and Amoy (80002)
  const isMumbai = EXPECTED_CHAIN_ID === 80001;
  const isAmoy = EXPECTED_CHAIN_ID === 80002;

  useEffect(() => {
    // Debug: Check if contract address is loaded
    if (!contractAddress) {
      console.error("Contract address not found! Check NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local");
    } else {
      console.log("Contract address:", contractAddress);
    }
  }, []);

  const loadIntents = useCallback(async () => {
    if (!contract) return;

    setLoadingIntents(true);
    try {
      // Create a read-only provider using Infura RPC if available
      let readContract = contract;
      const rpcUrl = (isMumbai && MUMBAI_RPC_URL) || (isAmoy && AMOY_RPC_URL);
      if (rpcUrl && (isMumbai || isAmoy) && contractAddress) {
        try {
          const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
          // Test connection
          await rpcProvider.getBlockNumber();
          // Create read-only contract instance
          readContract = new ethers.Contract(contractAddress, INTENT_REGISTRY_ABI, rpcProvider);
          console.log(`Using Infura RPC for reading intents (${isMumbai ? 'Mumbai' : 'Amoy'})`);
        } catch (rpcError) {
          console.warn("Infura RPC failed for reads, using MetaMask provider:", rpcError);
          // Continue with original contract (MetaMask provider)
        }
      }
      
      // First check if there are any intents
      const count = await readContract.getIntentCount();
      const intentCount = Number(count);
      
      console.log("Intent count:", intentCount);
      
      if (intentCount === 0) {
        setIntents([]);
        return;
      }

      // Use pagination for gas efficiency (fetch in batches of 50)
      const PAGE_SIZE = 50;
      const allIntents: any[] = [];
      
      for (let offset = 0; offset < intentCount; offset += PAGE_SIZE) {
        const page = await readContract.getIntentsPaginated(offset, PAGE_SIZE);
        allIntents.push(...page);
      }

      const formattedIntents = allIntents.map((intent: any, index: number) => ({
        id: index,
        user: intent.user,
        message: intent.message,
        category: intent.category,
        cid: intent.cid,
        timestamp: Number(intent.timestamp),
      }));

      // Try to fetch IPFS data for each intent (optional, don't fail if IPFS is down)
      const intentsWithData = await Promise.all(
        formattedIntents.map(async (intent) => {
          try {
            const ipfsData = await fetchFromIPFS(intent.cid);
            return { ...intent, ipfsData };
          } catch (error) {
            // Silently fail IPFS fetch - it's optional metadata
            console.warn(`Could not fetch IPFS data for ${intent.cid} (this is okay)`);
            return intent;
          }
        })
      );

      setIntents(intentsWithData);
    } catch (error: any) {
      console.error("Error loading intents:", error);
      // If contract is empty or not deployed, just set empty array
      if (error.message?.includes("could not decode") || error.message?.includes("BAD_DATA")) {
        console.log("Contract appears empty or not initialized, showing empty list");
        setIntents([]);
      }
    } finally {
      setLoadingIntents(false);
    }
  }, [contract]);

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true);
    try {
      const response = await fetch(`${API_URL}/matches`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setMatches(data.matches || []);
    } catch (error) {
      console.error("Error loading matches:", error);
      setMatches([]); // Set empty array on error
    } finally {
      setLoadingMatches(false);
    }
  }, [API_URL]);

  useEffect(() => {
    // Load matches from backend even without contract connection
    loadMatches();
    
    // Load intents from blockchain if contract is connected
    if (contract && account) {
      loadIntents();
    }
  }, [contract, account, loadIntents, loadMatches]);

  const checkNetwork = async (provider: ethers.BrowserProvider): Promise<boolean> => {
    // Prevent multiple simultaneous network switch requests using ref (faster than state)
    if (switchingNetworkRef.current) {
      console.log("Network switch already in progress, skipping...");
      return false;
    }

    try {
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      
      console.log("Current chain ID:", chainId, "Expected:", EXPECTED_CHAIN_ID);
      
      if (chainId !== EXPECTED_CHAIN_ID) {
        // Set flag immediately before making request
        switchingNetworkRef.current = true;
        setNetworkError(`Wrong network! Please switch to chain ID ${EXPECTED_CHAIN_ID}`);
        
        // Try to switch network
        try {
          if (!window.ethereum) {
            setNetworkError("MetaMask not found");
            switchingNetworkRef.current = false;
            return false;
          }
          
          try {
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}` }],
            });
            setNetworkError("");
            switchingNetworkRef.current = false;
            return true;
          } catch (switchError: any) {
            // Handle "already pending" error - this is OK, just wait
            if (switchError.code === -32002 || switchError.message?.includes("already pending")) {
              console.log("Network switch request already pending in MetaMask - this is normal");
              setNetworkError("Please approve the network switch in MetaMask");
              // Reset flag after a delay to allow user to approve
              setTimeout(() => {
                switchingNetworkRef.current = false;
              }, 10000); // 10 seconds should be enough
              return false;
            }
            
            // Chain doesn't exist, try to add it
            if (switchError.code === 4902 && window.ethereum) {
              try {
                // Determine network configuration based on chain ID
                let networkConfig: any;
                if (EXPECTED_CHAIN_ID === 80001) {
                  // Polygon Mumbai - use Infura RPC if custom RPC not set
                  const customRpc = process.env.NEXT_PUBLIC_MUMBAI_RPC_URL;
                  const rpcUrls = customRpc 
                    ? [customRpc]
                    : [
                        "https://polygon-mumbai.infura.io/v3/demo",
                        "https://rpc.ankr.com/polygon_mumbai",
                        "https://polygon-mumbai-bor.publicnode.com",
                        "https://rpc-mumbai.maticvigil.com"
                      ];
                  
                  networkConfig = {
                    chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}`,
                    chainName: "Polygon Mumbai",
                    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
                    rpcUrls: rpcUrls,
                    blockExplorerUrls: ["https://mumbai.polygonscan.com"]
                  };
                } else if (EXPECTED_CHAIN_ID === 80002) {
                  // Polygon Amoy - use Infura RPC if custom RPC not set
                  const customRpc = process.env.NEXT_PUBLIC_AMOY_RPC_URL;
                  const rpcUrls = customRpc 
                    ? [customRpc]
                    : [
                        "https://polygon-amoy.infura.io/v3/demo",
                        "https://rpc.ankr.com/polygon_amoy",
                        "https://polygon-amoy-bor.publicnode.com"
                      ];
                  
                  networkConfig = {
                    chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}`,
                    chainName: "Polygon Amoy",
                    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
                    rpcUrls: rpcUrls,
                    blockExplorerUrls: ["https://amoy.polygonscan.com"]
                  };
                } else if (EXPECTED_CHAIN_ID === 31337) {
                  // Hardhat Local
                  networkConfig = {
                    chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}`,
                    chainName: "Hardhat Local",
                    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                    rpcUrls: ["http://127.0.0.1:8545"],
                  };
                } else {
                  throw new Error(`Unsupported chain ID: ${EXPECTED_CHAIN_ID}`);
                }

                await window.ethereum.request({
                  method: "wallet_addEthereumChain",
                  params: [networkConfig],
                });
                setNetworkError("");
                switchingNetworkRef.current = false;
                return true;
              } catch (addError: any) {
                if (addError.code === -32002 || addError.message?.includes("already pending")) {
                  console.log("Add network request already pending in MetaMask");
                  setNetworkError("Please approve adding the network in MetaMask");
                  setTimeout(() => {
                    switchingNetworkRef.current = false;
                  }, 10000);
                  return false;
                }
                setNetworkError(`Please add network with chain ID ${EXPECTED_CHAIN_ID} manually in MetaMask`);
                switchingNetworkRef.current = false;
                return false;
              }
            }
            setNetworkError(`Please switch to chain ID ${EXPECTED_CHAIN_ID} in MetaMask`);
            switchingNetworkRef.current = false;
            return false;
          }
        } catch (error: any) {
          console.error("Network switch error:", error);
          switchingNetworkRef.current = false;
          if (error.code === -32002 || error.message?.includes("already pending")) {
            setNetworkError("Network switch request pending. Please check MetaMask.");
          } else {
            setNetworkError("Failed to switch network");
          }
          return false;
        }
      }
      
      setNetworkError("");
      switchingNetworkRef.current = false;
      return true;
    } catch (error) {
      console.error("Error checking network:", error);
      setNetworkError("Could not verify network");
      switchingNetworkRef.current = false;
      return false;
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        // Create MetaMask provider for signing
        const metamaskProvider = new ethers.BrowserProvider(window.ethereum);
        await metamaskProvider.send("eth_requestAccounts", []);
        
        // Create a fallback provider: use Infura RPC for reads, MetaMask for writes
        let readProvider: ethers.Provider = metamaskProvider;
        
        // If we have a custom RPC URL, use it for read operations
        const rpcUrl = (isMumbai && MUMBAI_RPC_URL) || (isAmoy && AMOY_RPC_URL);
        if (rpcUrl && (isMumbai || isAmoy)) {
          try {
            const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
            // Test the RPC connection
            await rpcProvider.getBlockNumber();
            readProvider = rpcProvider;
            console.log(`Using Infura RPC for read operations (${isMumbai ? 'Mumbai' : 'Amoy'})`);
          } catch (rpcError) {
            console.warn("Custom RPC failed, falling back to MetaMask RPC:", rpcError);
            // Fall back to MetaMask provider if custom RPC fails
          }
        }
        
        // Use MetaMask for signing (user interactions)
        const signer = await metamaskProvider.getSigner();
        const address = await signer.getAddress();

        console.log("Wallet connected:", address);
        console.log("Contract address from env:", contractAddress);

        // Store both providers
        setProvider(metamaskProvider);
        setSigner(signer);
        setAccount(address);

        if (contractAddress) {
          // Create contract instance with signer for writes, but use readProvider for reads
          // For writes, we need the signer. For reads, we can use the readProvider
          const contractInstance = new ethers.Contract(
            contractAddress,
            INTENT_REGISTRY_ABI,
            signer
          );
          
          // Override the provider for read-only operations
          // Note: This is a workaround - ethers v6 doesn't easily support separate read/write providers
          // But the contract will use the signer's provider for all operations
          // The readProvider is available if we need to make direct read calls
          setContract(contractInstance);
          console.log("Contract instance created");
        } else {
          alert("Contract address not configured! Please check your .env.local file.");
        }

        // Check network after connecting (non-blocking)
        // This allows connection to proceed even if network is wrong
        checkNetwork(metamaskProvider).catch(err => {
          console.error("Network check error:", err);
        });
      } catch (error) {
        console.error("Error connecting wallet:", error);
        alert("Failed to connect wallet: " + (error as Error).message);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // Input sanitization
  const sanitizeInput = (input: string, maxLength: number): string => {
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>]/g, ""); // Remove potential HTML tags
  };

  const publishIntent = async () => {
    if (!signer || !contract || !message || !category) {
      alert("Please fill in message and category");
      return;
    }

    setLoading(true);
    try {
      let cid = "ipfs-placeholder"; // Default if IPFS is unavailable
      
      // Try to upload metadata to IPFS via backend (token not exposed)
      try {
        const ipfsData = {
          message,
          category,
          budget: budget || undefined,
          timestamp: new Date().toISOString(),
        };
        
        const response = await fetch(`${API_URL}/api/upload-ipfs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: ipfsData }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (result.cid) {
          cid = result.cid;
          console.log("IPFS upload successful, CID:", cid);
        } else {
          throw new Error("No CID returned from server");
        }
      } catch (ipfsError: any) {
        console.warn("IPFS upload failed, using placeholder:", ipfsError.message);
        // Use a placeholder CID - the contract will still work
        cid = `ipfs-unavailable-${Date.now()}`;
        // Don't show alert - just log it, transaction will still work
        console.log("Continuing with on-chain publish (IPFS is optional)");
      }

      // Sanitize inputs before sending
      const sanitizedMessage = sanitizeInput(message, 500);
      const sanitizedCategory = sanitizeInput(category, 50);

      // Check network before sending transaction - this is important!
      if (provider) {
        try {
          const network = await provider.getNetwork();
          const chainId = Number(network.chainId);
          
          if (chainId !== EXPECTED_CHAIN_ID) {
            const networkName = chainId === 80001 ? "Mumbai" : chainId === 80002 ? "Amoy" : `Chain ${chainId}`;
            const expectedName = EXPECTED_CHAIN_ID === 80001 ? "Mumbai" : EXPECTED_CHAIN_ID === 80002 ? "Amoy" : `Chain ${EXPECTED_CHAIN_ID}`;
            
            console.log(`Network mismatch: current=${networkName} (${chainId}), expected=${expectedName} (${EXPECTED_CHAIN_ID})`);
            setNetworkError(`Wrong network! Switch from ${networkName} to ${expectedName} in MetaMask`);
            
            // Try to switch network
            try {
              if (window.ethereum) {
                await window.ethereum.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}` }],
                });
                // If switch succeeds, clear error and continue
                setNetworkError("");
                console.log("Network switched successfully");
              }
            } catch (switchError: any) {
              // If network doesn't exist, try to add it
              if (switchError.code === 4902 && window.ethereum) {
                let networkConfig: any;
                if (EXPECTED_CHAIN_ID === 80001) {
                  // Polygon Mumbai - use Infura RPC if custom RPC not set
                  const customRpc = process.env.NEXT_PUBLIC_MUMBAI_RPC_URL;
                  const rpcUrls = customRpc 
                    ? [customRpc]
                    : [
                        "https://polygon-mumbai.infura.io/v3/demo",
                        "https://rpc.ankr.com/polygon_mumbai",
                        "https://polygon-mumbai-bor.publicnode.com",
                        "https://rpc-mumbai.maticvigil.com"
                      ];
                  
                  networkConfig = {
                    chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}`,
                    chainName: "Polygon Mumbai",
                    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
                    rpcUrls: rpcUrls,
                    blockExplorerUrls: ["https://mumbai.polygonscan.com"]
                  };
                } else if (EXPECTED_CHAIN_ID === 80002) {
                  // Polygon Amoy - use Infura RPC if custom RPC not set
                  const customRpc = process.env.NEXT_PUBLIC_AMOY_RPC_URL;
                  const rpcUrls = customRpc 
                    ? [customRpc]
                    : [
                        "https://polygon-amoy.infura.io/v3/demo",
                        "https://rpc.ankr.com/polygon_amoy",
                        "https://polygon-amoy-bor.publicnode.com"
                      ];
                  
                  networkConfig = {
                    chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}`,
                    chainName: "Polygon Amoy",
                    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
                    rpcUrls: rpcUrls,
                    blockExplorerUrls: ["https://amoy.polygonscan.com"]
                  };
                } else if (EXPECTED_CHAIN_ID === 31337) {
                  networkConfig = {
                    chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}`,
                    chainName: "Hardhat Local",
                    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                    rpcUrls: ["http://127.0.0.1:8545"],
                  };
                }
                
                if (networkConfig) {
                  try {
                    await window.ethereum.request({
                      method: "wallet_addEthereumChain",
                      params: [networkConfig],
                    });
                    setNetworkError("");
                  } catch (addError) {
                    // User might have rejected or it's pending - that's OK
                    console.log("Network add request:", addError);
                  }
                }
              }
              // If switch failed, throw error to prevent transaction on wrong network
              const networkName = chainId === 80001 ? "Mumbai" : chainId === 80002 ? "Amoy" : `Chain ${chainId}`;
              const expectedName = EXPECTED_CHAIN_ID === 80001 ? "Mumbai" : EXPECTED_CHAIN_ID === 80002 ? "Amoy" : `Chain ${EXPECTED_CHAIN_ID}`;
              throw new Error(`Please switch to ${expectedName} network (Chain ID: ${EXPECTED_CHAIN_ID}) in MetaMask. Currently on ${networkName} (${chainId}).`);
            }
          } else {
            setNetworkError(""); // Clear any previous network errors
          }
        } catch (error) {
          // If it's a network mismatch error, throw it
          if (error instanceof Error && error.message.includes("Please switch to")) {
            throw error;
          }
          console.warn("Network check failed:", error);
          // For other errors, continue (might be connection issue)
        }
      }

      // Check balance before sending transaction (warn but don't block)
      if (provider && signer) {
        try {
          const balance = await provider.getBalance(await signer.getAddress());
          const balanceInEth = ethers.formatEther(balance);
          console.log("Account balance:", balanceInEth, "MATIC");
          
          // Warn if balance is very low, but don't block the transaction
          if (Number(balanceInEth) < 0.001) {
            console.warn("⚠️ Low balance detected. Transaction may fail. Get test tokens from: https://faucet.polygon.technology/");
            setTxStatus({ status: "pending", message: "⚠️ Low balance - transaction may fail. Continuing anyway..." });
            // Don't throw - let user try anyway
          }
        } catch (balanceError: any) {
          console.warn("Could not check balance:", balanceError);
          // Don't block - continue with transaction
        }
      }

      // Estimate gas before sending
      let gasEstimate;
      try {
        gasEstimate = await contract.publishIntent.estimateGas(sanitizedMessage, sanitizedCategory, cid);
        console.log("Estimated gas:", gasEstimate.toString());
      } catch (gasError: any) {
        console.warn("Gas estimation failed:", gasError);
        // Continue anyway - MetaMask will estimate
      }

      // Publish intent on-chain (this is the important part)
      console.log("Publishing intent on-chain...");
      setTxStatus({ status: "pending", message: "Please approve transaction in MetaMask..." });
      
      // Use a more explicit transaction with better error handling
      const tx = await contract.publishIntent(sanitizedMessage, sanitizedCategory, cid, {
        // Let MetaMask handle gas estimation, but provide estimate if available
        gasLimit: gasEstimate ? gasEstimate + BigInt(10000) : undefined, // Add 10% buffer
      });
      
      console.log("Transaction sent:", tx.hash);
      setTxStatus({ hash: tx.hash, status: "pending", message: "Waiting for confirmation..." });
      
      // Wait for confirmation with timeout
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Transaction timeout after 2 minutes")), 120000) // 2 minutes
        )
      ]);
      
      console.log("Transaction confirmed!", receipt);
      setTxStatus({ hash: tx.hash, status: "success", message: "Transaction confirmed!" });

      // Reload intents
      await loadIntents();
      await loadMatches();

      // Reset form
      setMessage("");
      setCategory("");
      setBudget("");
      
      // Clear status after 3 seconds
      setTimeout(() => setTxStatus({}), 3000);
    } catch (error: any) {
      console.error("Error publishing intent:", error);
      
      // Handle specific contract errors
      let errorMessage = "Failed to publish intent";
      let showAlert = true;
      
      if (error.message) {
        if (error.message.includes("Insufficient balance")) {
          errorMessage = error.message;
        } else if (error.message.includes("user rejected") || error.message.includes("User denied")) {
          errorMessage = "Transaction was cancelled by user";
          showAlert = false; // Don't show alert for user cancellation
        } else if (error.message.includes("Message cannot be empty") || 
            error.message.includes("Category cannot be empty") ||
            error.message.includes("CID cannot be empty")) {
          errorMessage = "Please fill in all required fields";
        } else if (error.message.includes("too long")) {
          errorMessage = error.message.match(/too long.*/)?.[0] || "Input too long";
        } else if (error.message.includes("Rate limit exceeded")) {
          errorMessage = "You've reached the daily limit (10 intents per day). Try again tomorrow.";
        } else if (error.message.includes("insufficient funds") || error.message.includes("insufficient balance")) {
          errorMessage = "Insufficient balance for gas fees! Get test tokens from: https://faucet.polygon.technology/";
        } else if (error.message.includes("network") || error.message.includes("chain")) {
          errorMessage = `Network mismatch! Please switch to the correct network in MetaMask (Chain ID: ${EXPECTED_CHAIN_ID})`;
        } else if (error.message.includes("timeout")) {
          errorMessage = "Transaction timed out. Please check MetaMask and try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setTxStatus({ status: "error", message: errorMessage });
      
      if (showAlert) {
        alert(`Error: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Intent Registry</h1>

      {!account ? (
        <div>
          <button
            onClick={connectWallet}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Connect MetaMask
          </button>
          {!contractAddress && (
            <p style={{ color: "red", marginTop: "10px" }}>
              ⚠️ Contract address not configured! Check .env.local file.
            </p>
          )}
        </div>
      ) : (
        <div>
          <p>Connected: {account}</p>
          {networkError && (
            <div style={{ 
              padding: "10px", 
              backgroundColor: "#ffebee", 
              border: "1px solid #f44336", 
              borderRadius: "5px",
              marginTop: "10px",
              color: "#c62828"
            }}>
              ⚠️ {networkError}
            </div>
          )}

          <div style={{ marginTop: "30px", padding: "20px", border: "1px solid #ddd", borderRadius: "5px" }}>
            <h2>Publish Intent</h2>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Message: <span style={{ color: "#666", fontSize: "12px" }}>(max 500 chars)</span></label>
              <input
                type="text"
                value={message}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.length <= 500) {
                    setMessage(val);
                  }
                }}
                placeholder="What do you want or offer?"
                maxLength={500}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
              {message.length > 0 && (
                <span style={{ fontSize: "12px", color: message.length > 500 ? "red" : "#666" }}>
                  {message.length}/500
                </span>
              )}
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Category: <span style={{ color: "#666", fontSize: "12px" }}>(max 50 chars)</span></label>
              <input
                type="text"
                value={category}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.length <= 50) {
                    setCategory(val);
                  }
                }}
                placeholder="e.g., design, development, marketing"
                maxLength={50}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
              {category.length > 0 && (
                <span style={{ fontSize: "12px", color: category.length > 50 ? "red" : "#666" }}>
                  {category.length}/50
                </span>
              )}
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Budget (optional):</label>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g., $1000"
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
            </div>
            <button
              onClick={publishIntent}
              disabled={loading}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                backgroundColor: loading ? "#ccc" : "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Publishing..." : "Publish Intent"}
            </button>
            {txStatus.status && (
              <div style={{
                marginTop: "10px",
                padding: "10px",
                backgroundColor: txStatus.status === "success" ? "#e8f5e9" : txStatus.status === "error" ? "#ffebee" : "#fff3e0",
                border: `1px solid ${txStatus.status === "success" ? "#4caf50" : txStatus.status === "error" ? "#f44336" : "#ff9800"}`,
                borderRadius: "5px",
                color: txStatus.status === "success" ? "#2e7d32" : txStatus.status === "error" ? "#c62828" : "#e65100"
              }}>
                {txStatus.status === "pending" && "⏳ "}
                {txStatus.status === "success" && "✅ "}
                {txStatus.status === "error" && "❌ "}
                {txStatus.message}
                {txStatus.hash && (
                  <div style={{ fontSize: "12px", marginTop: "5px" }}>
                    TX: {txStatus.hash.slice(0, 10)}...{txStatus.hash.slice(-8)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: "30px" }}>
            <h2>All Intents ({intents.length})</h2>
            <button
              onClick={loadIntents}
              disabled={loadingIntents}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                backgroundColor: loadingIntents ? "#ccc" : "#666",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: loadingIntents ? "not-allowed" : "pointer",
                marginBottom: "10px",
              }}
            >
              {loadingIntents ? "Loading..." : "Refresh"}
            </button>
            {loadingIntents && <p style={{ color: "#666", fontSize: "14px" }}>Loading intents...</p>}
            <div style={{ display: "grid", gap: "15px" }}>
              {intents.map((intent) => (
                <div
                  key={intent.id}
                  style={{
                    padding: "15px",
                    border: "1px solid #ddd",
                    borderRadius: "5px",
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  <p><strong>User:</strong> {intent.user}</p>
                  <p><strong>Message:</strong> {intent.message}</p>
                  <p><strong>Category:</strong> {intent.category}</p>
                  <p><strong>CID:</strong> {intent.cid}</p>
                  <p><strong>Time:</strong> {formatTimestamp(intent.timestamp)}</p>
                  {intent.ipfsData && intent.ipfsData.budget && (
                    <p><strong>Budget:</strong> {intent.ipfsData.budget}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "30px" }}>
            <h2>Matches ({matches.length})</h2>
            <button
              onClick={loadMatches}
              disabled={loadingMatches}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                backgroundColor: loadingMatches ? "#ccc" : "#666",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: loadingMatches ? "not-allowed" : "pointer",
                marginBottom: "10px",
              }}
            >
              {loadingMatches ? "Loading..." : "Refresh"}
            </button>
            {loadingMatches && <p style={{ color: "#666", fontSize: "14px" }}>Loading matches...</p>}
            <div style={{ display: "grid", gap: "15px" }}>
              {matches.map((match) => (
                <div
                  key={match.id}
                  style={{
                    padding: "15px",
                    border: "2px solid #4CAF50",
                    borderRadius: "5px",
                    backgroundColor: "#f0f8f0",
                  }}
                >
                  <p><strong>Category:</strong> {match.category}</p>
                  <div style={{ marginTop: "10px" }}>
                    <p><strong>Intent 1:</strong> {match.intent1.message} (by {match.intent1.user})</p>
                    <p><strong>Intent 2:</strong> {match.intent2.message} (by {match.intent2.user})</p>
                  </div>
                  <p style={{ fontSize: "12px", color: "#666" }}>Matched at: {match.createdAt}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

