const express = require("express");
const cors = require("cors");
const { startListener } = require("./scripts/listener");

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage
let intents = [];
let matches = [];

// Store intents from listener
function addIntent(intent) {
  intents.push(intent);
  runMatching();
}

// Simple matching: group by category, create matches for pairs
function runMatching() {
  const categoryMap = {};
  
  // Group intents by category
  intents.forEach((intent, index) => {
    if (!categoryMap[intent.category]) {
      categoryMap[intent.category] = [];
    }
    categoryMap[intent.category].push({ ...intent, index });
  });

  // Create matches for categories with 2+ intents
  const newMatches = [];
  Object.keys(categoryMap).forEach(category => {
    const categoryIntents = categoryMap[category];
    if (categoryIntents.length >= 2) {
      // Create matches between all pairs in the category
      for (let i = 0; i < categoryIntents.length; i++) {
        for (let j = i + 1; j < categoryIntents.length; j++) {
          const matchId = `${categoryIntents[i].intentId}-${categoryIntents[j].intentId}`;
          // Check if match already exists
          if (!matches.find(m => m.id === matchId)) {
            const match = {
              id: matchId,
              category: category,
              intent1: categoryIntents[i],
              intent2: categoryIntents[j],
              createdAt: new Date().toISOString()
            };
            matches.push(match);
            newMatches.push(match);
          }
        }
      }
    }
  });

  if (newMatches.length > 0) {
    console.log(`Created ${newMatches.length} new match(es)`);
  }
}

// API Routes
app.get("/intents", (req, res) => {
  res.json({ intents, count: intents.length });
});

app.get("/matches", (req, res) => {
  res.json({ matches, count: matches.length });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", intents: intents.length, matches: matches.length });
});

// Export for listener
module.exports = { addIntent, intents, matches };

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log("Starting event listener...");
  
  // Start listening to blockchain events
  startListener(addIntent).catch(console.error);
});

