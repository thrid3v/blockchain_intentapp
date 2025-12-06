# Intent Registry - Hackathon MVP

A decentralized intent-matching platform where users publish intents (what they want or offer) stored on-chain, with metadata on IPFS.

## Project Structure

```
bc_hack/
├── contracts/          # Hardhat project
│   ├── contracts/
│   │   └── IntentRegistry.sol
│   ├── scripts/
│   │   └── deploy.js
│   └── hardhat.config.js
├── backend/            # Node.js API and event listener
│   ├── scripts/
│   │   └── listener.js
│   └── server.js
└── frontend/           # Next.js app
    ├── pages/
    │   └── index.tsx
    └── utils/
        └── ipfs.ts
```

## Prerequisites

- Node.js 18+
- npm
- MetaMask browser extension
- web3.storage account (get free token at https://web3.storage)

## Setup Instructions

### 1. Install Contract Dependencies

```bash
cd contracts
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox --legacy-peer-deps
```

### 2. Compile Contracts

```bash
cd contracts
npx hardhat compile
```

### 3. Start Local Hardhat Node

In a **new terminal**:

```bash
cd contracts
npx hardhat node
```

Keep this terminal open. You'll see accounts with test ETH.

### 4. Deploy Contract

In a **new terminal**:

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

**IMPORTANT:** Copy the deployed contract address from the output. It will look like:
```
IntentRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### 5. Setup Backend

In a **new terminal**:

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
RPC_URL=http://127.0.0.1:8545
PORT=3001
```

Replace `0x5FbDB2315678afecb367f032d93F642f64180aa3` with your actual deployed address.

### 6. Start Backend

```bash
cd backend
npm start
```

The backend will:
- Listen for `IntentPublished` events
- Store intents in memory
- Run simple category-based matching
- Expose API at http://localhost:3001

### 7. Setup Frontend

In a **new terminal**:

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_WEB3STORAGE_TOKEN=your_web3_storage_token_here
```

Replace:
- `0x5FbDB2315678afecb367f032d93F642f64180aa3` with your deployed contract address
- `your_web3_storage_token_here` with your web3.storage API token

### 8. Start Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3000 in your browser.

### 9. Import Hardhat Account to MetaMask

1. Open MetaMask
2. Click network dropdown → "Add Network" → "Add a network manually"
3. Enter:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
4. Import account:
   - In the Hardhat node terminal, copy a private key from one of the accounts
   - In MetaMask: Account menu → "Import Account" → paste private key

## Usage

1. **Connect Wallet**: Click "Connect MetaMask" and approve the connection
2. **Publish Intent**: Fill in message, category, and optional budget, then click "Publish Intent"
   - The app will upload metadata to IPFS
   - Then publish the intent on-chain
3. **View Intents**: All published intents appear in the "All Intents" section
4. **View Matches**: The backend automatically matches intents by category. View matches in the "Matches" section

## API Endpoints

- `GET http://localhost:3001/intents` - Get all intents
- `GET http://localhost:3001/matches` - Get all matches
- `GET http://localhost:3001/health` - Health check

## Deploying to Polygon Mumbai (Optional)

### Update Hardhat Config

Ensure `contracts/hardhat.config.js` has Mumbai network configured.

### Set Environment Variables

In `contracts/` directory, create `.env`:

```env
MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_private_key_here
```

### Deploy

```bash
cd contracts
npx hardhat run scripts/deploy.js --network mumbai
```

Update `backend/.env` and `frontend/.env.local` with the new contract address and Mumbai RPC URL.

## Troubleshooting

- **"ABI not found"**: Make sure you've compiled contracts (`npx hardhat compile`)
- **"CONTRACT_ADDRESS not set"**: Check your `.env` files have the correct address
- **MetaMask connection fails**: Ensure you're on the correct network (Hardhat Local or Mumbai)
- **IPFS upload fails**: Verify `NEXT_PUBLIC_WEB3STORAGE_TOKEN` is set correctly
- **Peer dependency conflicts**: Use `--legacy-peer-deps` flag with npm install

## Notes

- All intents and matches are stored in-memory in the backend (will reset on restart)
- For production, replace in-memory storage with a database (Supabase, PostgreSQL, etc.)
- The matching algorithm is simple: any two intents in the same category create a match
- Contract uses Solidity 0.8.20 for gas efficiency

