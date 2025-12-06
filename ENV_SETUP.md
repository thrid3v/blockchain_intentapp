# Environment Variables Setup Guide

## Files to Create

You need to create **2 files** with the exact content below:

---

## 1. Backend Environment File

**File Path:** `backend/.env`

**Create this file:** `C:\bc_hack\backend\.env`

**Content to paste:**

```env
# Intent Registry Backend Environment Variables

# Contract Address (from deployment output)
# After running: npx hardhat run scripts/deploy.js --network localhost
# Copy the address that looks like: 0x5FbDB2315678afecb367f032d93F642f64180aa3
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3

# RPC URL for connecting to the blockchain
# For local Hardhat node, use: http://127.0.0.1:8545
# For Polygon Mumbai testnet, use your Alchemy/Infura URL
RPC_URL=http://127.0.0.1:8545

# Port for the backend API server
# Default: 3001
PORT=3001

# Web3.Storage API Token (for IPFS uploads via backend)
# Get your free token at: https://web3.storage
# This keeps the token secure on the backend instead of exposing it in the frontend
WEB3STORAGE_TOKEN=your_web3_storage_token_here

# Allowed CORS origins (comma-separated)
# For local development, defaults to http://localhost:3000,http://127.0.0.1:3000
# For production, set to your frontend domain(s)
# ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

**What to change:**
- `CONTRACT_ADDRESS` - Use the address from your deployment (you already have: `0x5FbDB2315678afecb367f032d93F642f64180aa3`)
- `RPC_URL` - Keep as is for local development
- `PORT` - Keep as is (3001)

---

## 2. Frontend Environment File

**File Path:** `frontend/.env.local`

**Create this file:** `C:\bc_hack\frontend\.env.local`

**Content to paste:**

```env
# Intent Registry Frontend Environment Variables
# Note: In Next.js, environment variables prefixed with NEXT_PUBLIC_ are exposed to the browser

# Contract Address (from deployment output)
# After running: npx hardhat run scripts/deploy.js --network localhost
# Copy the address that looks like: 0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3

# API URL (backend server)
# For local development, use: http://localhost:3001
# For production, set to your backend domain
NEXT_PUBLIC_API_URL=http://localhost:3001

# Chain ID for network validation
# For Hardhat local: 31337
# For Polygon Mumbai: 80001
NEXT_PUBLIC_CHAIN_ID=31337
```

**What to change:**
- `NEXT_PUBLIC_CONTRACT_ADDRESS` - Use the address from your deployment (you already have: `0x5FbDB2315678afecb367f032d93F642f64180aa3`)
- `NEXT_PUBLIC_WEB3STORAGE_TOKEN` - Replace `your_web3_storage_token_here` with your actual web3.storage token

---

## Quick Copy-Paste Summary

### File 1: `backend/.env`
```
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
RPC_URL=http://127.0.0.1:8545
PORT=3001
WEB3STORAGE_TOKEN=your_web3_storage_token_here
```

### File 2: `frontend/.env.local`
```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=31337
```

**Remember:** 
- Replace `your_web3_storage_token_here` in `backend/.env` with your actual web3.storage token
- The token is now in the backend (more secure) instead of the frontend

---

## Verification

After creating both files, verify they exist:
- ✅ `C:\bc_hack\backend\.env` exists
- ✅ `C:\bc_hack\frontend\.env.local` exists

Then you can proceed to start the backend and frontend servers.

