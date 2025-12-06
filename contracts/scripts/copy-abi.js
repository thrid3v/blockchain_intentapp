const fs = require("fs");
const path = require("path");

// Copy ABI to frontend after compilation
const artifactPath = path.join(__dirname, "../artifacts/contracts/IntentRegistry.sol/IntentRegistry.json");
const frontendABIPath = path.join(__dirname, "../../frontend/abi/IntentRegistry.json");

if (fs.existsSync(artifactPath)) {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;

  // Ensure frontend/abi directory exists
  const abiDir = path.dirname(frontendABIPath);
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  fs.writeFileSync(frontendABIPath, JSON.stringify(abi, null, 2));
  console.log("ABI copied to frontend/abi/IntentRegistry.json");
} else {
  console.error("Artifact not found. Please compile contracts first.");
  process.exit(1);
}

