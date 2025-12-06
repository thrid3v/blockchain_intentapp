const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { startListener } = require("./scripts/listener");
const { initDB, getIntents, addIntent, getMatches, addMatch } = require("./db");

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later."
});

app.use("/api/", limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Database
let db = null;

// Initialize database
initDB()
  .then((database) => {
    db = database;
    console.log("Database initialized");
    // Load existing data
    loadDataFromDB();
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    // Fallback to in-memory (for development)
    console.warn("Falling back to in-memory storage");
  });

// Debounce matching to avoid race conditions
let matchingTimeout = null;
const MATCHING_DEBOUNCE_MS = 1000; // Wait 1 second after last intent before matching

// Store intents from listener
async function addIntentToDB(intent) {
  if (db) {
    try {
      await addIntent(db, intent);
    } catch (err) {
      console.error("Error saving intent to DB:", err);
    }
  }
  
  // Debounce matching: clear existing timeout and set new one
  if (matchingTimeout) {
    clearTimeout(matchingTimeout);
  }
  
  matchingTimeout = setTimeout(async () => {
    await runMatching();
    matchingTimeout = null;
  }, MATCHING_DEBOUNCE_MS);
}

async function loadDataFromDB() {
  if (!db) return;
  try {
    const dbIntents = await getIntents(db);
    console.log(`Loaded ${dbIntents.length} intents from database`);
  } catch (err) {
    console.error("Error loading data from DB:", err);
  }
}

// Simple matching: group by category, create matches for pairs
async function runMatching() {
  if (!db) return;
  
  try {
    const allIntents = await getIntents(db);
    const categoryMap = {};
    
    // Group intents by category
    allIntents.forEach((intent) => {
      if (!categoryMap[intent.category]) {
        categoryMap[intent.category] = [];
      }
      categoryMap[intent.category].push(intent);
    });

    // Create matches for categories with 2+ intents
    const newMatches = [];
    for (const category of Object.keys(categoryMap)) {
      const categoryIntents = categoryMap[category];
      if (categoryIntents.length >= 2) {
        // Create matches between all pairs in the category
        for (let i = 0; i < categoryIntents.length; i++) {
          for (let j = i + 1; j < categoryIntents.length; j++) {
            const matchId = `${categoryIntents[i].intentId}-${categoryIntents[j].intentId}`;
            
            // Check if match already exists in DB
            const existingMatches = await getMatches(db);
            if (!existingMatches.find(m => m.id === matchId)) {
              const match = {
                id: matchId,
                category: category,
                intent1: categoryIntents[i],
                intent2: categoryIntents[j],
                createdAt: new Date().toISOString()
              };
              await addMatch(db, match);
              newMatches.push(match);
            }
          }
        }
      }
    }

    if (newMatches.length > 0) {
      console.log(`Created ${newMatches.length} new match(es)`);
    }
  } catch (err) {
    console.error("Error in matching:", err);
  }
}

// IPFS upload endpoint (moves token to backend)
const { Web3Storage, File } = require("web3.storage");

function getIPFSClient() {
  const token = process.env.WEB3STORAGE_TOKEN;
  if (!token) {
    throw new Error("WEB3STORAGE_TOKEN not set in backend .env");
  }
  return new Web3Storage({ token });
}

app.post("/api/upload-ipfs", async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !data.message || !data.category) {
      return res.status(400).json({ error: "Missing required fields: message, category" });
    }

    const client = getIPFSClient();
    
    // Create file for Node.js environment
    const fileContent = JSON.stringify(data, null, 2);
    const file = new File([fileContent], "intent.json", { type: "application/json" });
    
    console.log("Uploading to IPFS via web3.storage...");
    const cid = await client.put([file], {
      wrapWithDirectory: false,
    });
    
    console.log("Uploaded! CID:", cid);
    res.json({ cid });
  } catch (error) {
    console.error("IPFS upload error:", error);
    res.status(500).json({ error: error.message || "Failed to upload to IPFS" });
  }
});

// API Routes
app.get("/intents", async (req, res) => {
  try {
    if (db) {
      const intents = await getIntents(db);
      res.json({ intents, count: intents.length });
    } else {
      res.json({ intents: [], count: 0, error: "Database not initialized" });
    }
  } catch (err) {
    console.error("Error fetching intents:", err);
    res.status(500).json({ error: "Failed to fetch intents" });
  }
});

app.get("/matches", async (req, res) => {
  try {
    if (db) {
      const matches = await getMatches(db);
      res.json({ matches, count: matches.length });
    } else {
      res.json({ matches: [], count: 0, error: "Database not initialized" });
    }
  } catch (err) {
    console.error("Error fetching matches:", err);
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

app.get("/health", async (req, res) => {
  try {
    const intents = db ? await getIntents(db) : [];
    const matches = db ? await getMatches(db) : [];
    res.json({ 
      status: "ok", 
      intents: intents.length, 
      matches: matches.length,
      database: db ? "connected" : "not connected"
    });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Export for listener
module.exports = { addIntent: addIntentToDB };

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log("Starting event listener...");
  
  // Start listening to blockchain events
  startListener(addIntent).catch(console.error);
});

