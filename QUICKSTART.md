# Quick Start Guide - Intent Registry

## 🔑 Required Keys (For Local Development)

**You only need ONE key for local development:**

### 1. web3.storage Token (REQUIRED)
- **Get it here:** https://web3.storage
- **Sign up** (free account)
- **Go to:** Account → Create API Token
- **Copy the token** (starts with `eyJ...`)

**That's it for local development!** No other keys needed.

---

## 📋 Step-by-Step Setup (Do This Now)

### Step 1: Install Contract Dependencies
```bash
cd contracts
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox --legacy-peer-deps
```

### Step 2: Compile Contracts
```bash
cd contracts
npx hardhat compile
```

### Step 3: Start Local Blockchain (Terminal 1)
```bash
cd contracts
npx hardhat node
```
**Keep this terminal open!** You'll see 20 test accounts with private keys.

### Step 4: Deploy Contract (Terminal 2)
```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

**📝 COPY THE CONTRACT ADDRESS!** It will look like:
```
IntentRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Step 5: Setup Backend (Terminal 3)
```bash
cd backend
npm install
```

Create `backend/.env` file:
```env
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
RPC_URL=http://127.0.0.1:8545
PORT=3001
```
*(Replace with your actual contract address from Step 4)*

### Step 6: Start Backend
```bash
cd backend
npm start
```
You should see: "Backend server running on http://localhost:3001"

### Step 7: Setup Frontend (Terminal 4)
```bash
cd frontend
npm install
```

Create `frontend/.env.local` file:
```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_WEB3STORAGE_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
*(Replace with your contract address and web3.storage token)*

### Step 8: Start Frontend
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

### Step 9: Connect MetaMask

1. **Add Hardhat Network to MetaMask:**
   - Click network dropdown → "Add Network" → "Add a network manually"
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`

2. **Import Test Account:**
   - In the Hardhat node terminal (Terminal 1), copy a **private key** from one of the accounts
   - In MetaMask: Account menu → "Import Account" → paste the private key

3. **Connect in the app:**
   - Click "Connect MetaMask" button
   - Approve the connection

---

## ✅ Checklist

- [ ] Got web3.storage token
- [ ] Installed contract dependencies
- [ ] Compiled contracts
- [ ] Started Hardhat node (Terminal 1)
- [ ] Deployed contract (Terminal 2) - **copied address**
- [ ] Created `backend/.env` with contract address
- [ ] Started backend (Terminal 3)
- [ ] Created `frontend/.env.local` with contract address and web3.storage token
- [ ] Started frontend (Terminal 4)
- [ ] Added Hardhat network to MetaMask
- [ ] Imported test account to MetaMask
- [ ] Connected wallet in the app

---

## 🚀 Optional: Deploy to Polygon Mumbai

If you want to test on a real testnet, you'll need:

1. **MUMBAI_RPC_URL** - Get from:
   - Alchemy: https://www.alchemy.com (create app, get Mumbai RPC URL)
   - Or Infura: https://infura.io

2. **PRIVATE_KEY** - A test account private key with test MATIC
   - Get test MATIC from: https://faucet.polygon.technology/

3. Create `contracts/.env`:
```env
MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...
```

4. Deploy:
```bash
cd contracts
npx hardhat run scripts/deploy.js --network mumbai
```

5. Update `backend/.env` and `frontend/.env.local` with the new Mumbai contract address and RPC URL.

---

## 🆘 Troubleshooting

**"ABI not found"**
- Run `npx hardhat compile` in the contracts folder

**"CONTRACT_ADDRESS not set"**
- Check your `.env` files exist and have the correct address

**"NEXT_PUBLIC_WEB3STORAGE_TOKEN is not set"**
- Make sure you created `frontend/.env.local` (not `.env`)
- Restart the frontend dev server after creating the file

**MetaMask won't connect**
- Make sure you're on the "Hardhat Local" network in MetaMask
- Make sure Hardhat node is still running

**IPFS upload fails**
- Verify your web3.storage token is correct
- Check you have internet connection

---

## 📝 Summary

**For local development, you need:**
- ✅ web3.storage token (free, get at https://web3.storage)
- ✅ 4 terminal windows open
- ✅ MetaMask installed

**That's it!** No other keys or accounts needed for local testing.

