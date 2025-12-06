const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "intents.db");

// Initialize database
function initDB() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("Error opening database:", err);
        reject(err);
        return;
      }
      console.log("Connected to SQLite database");
    });

    // Create tables
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS intents (
          id TEXT PRIMARY KEY,
          intentId TEXT NOT NULL,
          user TEXT NOT NULL,
          message TEXT NOT NULL,
          category TEXT NOT NULL,
          cid TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          blockNumber TEXT,
          txHash TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS matches (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          intent1 TEXT NOT NULL,
          intent2 TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (intent1) REFERENCES intents(id),
          FOREIGN KEY (intent2) REFERENCES intents(id)
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_category ON intents(category)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_user ON intents(user)`);
    });

    resolve(db);
  });
}

// Get all intents
function getIntents(db) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM intents ORDER BY createdAt DESC", (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Add intent
function addIntent(db, intent) {
  return new Promise((resolve, reject) => {
    const id = intent.intentId || intent.id || Date.now().toString();
    db.run(
      `INSERT OR REPLACE INTO intents (id, intentId, user, message, category, cid, timestamp, blockNumber, txHash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        intent.intentId || id,
        intent.user,
        intent.message,
        intent.category,
        intent.cid,
        intent.timestamp,
        intent.blockNumber || null,
        intent.txHash || null,
      ],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

// Get all matches
function getMatches(db) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT m.*, 
              i1.message as intent1_message, i1.user as intent1_user,
              i2.message as intent2_message, i2.user as intent2_user
       FROM matches m
       LEFT JOIN intents i1 ON m.intent1 = i1.id
       LEFT JOIN intents i2 ON m.intent2 = i2.id
       ORDER BY m.createdAt DESC`,
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// Add match
function addMatch(db, match) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO matches (id, category, intent1, intent2)
       VALUES (?, ?, ?, ?)`,
      [match.id, match.category, match.intent1.id, match.intent2.id],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

module.exports = { initDB, getIntents, addIntent, getMatches, addMatch };

