import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { uploadToIPFS, fetchFromIPFS } from "../utils/ipfs";

// Contract ABI (minimal for what we need)
const INTENT_REGISTRY_ABI = [
  "function publishIntent(string memory message, string memory category, string memory cid) public",
  "function getAllIntents() public view returns (tuple(address user, string message, string category, string cid, uint256 timestamp)[])",
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
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [budget, setBudget] = useState("");

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

  useEffect(() => {
    if (contract && account) {
      loadIntents();
      loadMatches();
    }
  }, [contract, account]);

  const connectWallet = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        setProvider(provider);
        setSigner(signer);
        setAccount(address);

        if (contractAddress) {
          const contractInstance = new ethers.Contract(
            contractAddress,
            INTENT_REGISTRY_ABI,
            signer
          );
          setContract(contractInstance);
        }
      } catch (error) {
        console.error("Error connecting wallet:", error);
        alert("Failed to connect wallet");
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const loadIntents = async () => {
    if (!contract) return;

    try {
      const allIntents = await contract.getAllIntents();
      const formattedIntents = allIntents.map((intent: any, index: number) => ({
        id: index,
        user: intent.user,
        message: intent.message,
        category: intent.category,
        cid: intent.cid,
        timestamp: Number(intent.timestamp),
      }));

      // Try to fetch IPFS data for each intent
      const intentsWithData = await Promise.all(
        formattedIntents.map(async (intent) => {
          try {
            const ipfsData = await fetchFromIPFS(intent.cid);
            return { ...intent, ipfsData };
          } catch (error) {
            console.error(`Failed to fetch IPFS data for ${intent.cid}:`, error);
            return intent;
          }
        })
      );

      setIntents(intentsWithData);
    } catch (error) {
      console.error("Error loading intents:", error);
    }
  };

  const loadMatches = async () => {
    try {
      const response = await fetch("http://localhost:3001/matches");
      const data = await response.json();
      setMatches(data.matches || []);
    } catch (error) {
      console.error("Error loading matches:", error);
    }
  };

  const publishIntent = async () => {
    if (!signer || !contract || !message || !category) {
      alert("Please fill in message and category");
      return;
    }

    setLoading(true);
    try {
      // Upload metadata to IPFS
      const ipfsData = {
        message,
        category,
        budget: budget || undefined,
        timestamp: new Date().toISOString(),
      };
      const cid = await uploadToIPFS(ipfsData);

      // Publish intent on-chain
      const tx = await contract.publishIntent(message, category, cid);
      console.log("Transaction sent:", tx.hash);
      
      await tx.wait();
      console.log("Transaction confirmed!");

      // Reload intents
      await loadIntents();
      await loadMatches();

      // Reset form
      setMessage("");
      setCategory("");
      setBudget("");
    } catch (error: any) {
      console.error("Error publishing intent:", error);
      alert(`Error: ${error.message || "Failed to publish intent"}`);
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
        </div>
      ) : (
        <div>
          <p>Connected: {account}</p>

          <div style={{ marginTop: "30px", padding: "20px", border: "1px solid #ddd", borderRadius: "5px" }}>
            <h2>Publish Intent</h2>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Message:</label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What do you want or offer?"
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Category:</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., design, development, marketing"
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
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
          </div>

          <div style={{ marginTop: "30px" }}>
            <h2>All Intents ({intents.length})</h2>
            <button
              onClick={loadIntents}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                backgroundColor: "#666",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                marginBottom: "10px",
              }}
            >
              Refresh
            </button>
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
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                backgroundColor: "#666",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                marginBottom: "10px",
              }}
            >
              Refresh
            </button>
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

