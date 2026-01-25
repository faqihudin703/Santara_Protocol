# 🇮🇩 Santara Protocol

**The End-to-End Digital Rupiah Ecosystem on Base Sepolia Chain.**

> *Bridging traditional Indonesian banking with Global DeFi via Direct Oracle Swaps & Treasury-Backed Yields.*

![Network](https://img.shields.io/badge/Network-Base%20Sepolia-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Protocol%20Live-orange)

## 📖 Overview

**Santara Protocol** is a decentralized infrastructure layer designed to bring the Indonesian Rupiah (IDR) on-chain. It solves the friction of high-fee "double conversion" (IDR → USD → ETH) by allowing direct swaps between ETH and a Rupiah-pegged stablecoin (**IDRX**) using real-time market data from local exchanges.

## 🚀 Key Features

### 1. Santara Direct Swap (The Engine)
We eliminated the need for USD intermediaries. Our custom **Oracle Node** fetches real-time ETH/IDR prices from **Indodax** and publishes them on-chain.
* **Mechanism:** Swap **ETH directly to IDRX** (and vice-versa) at fair market rates.
* **Fee Structure:**
    * **ETH Swaps:** 30 BPS (0.30%)
    * **wSAN (Governance) Swaps:** 10 BPS (0.10%) - *Holder Discount*
* **Safety:** Built-in slippage protection and deadline checks.

### 2. Fiat Settlement Gateway (On-Ramp)
A simulated banking interface bridging Web2 and Web3.
* **Function:** Users generate unique **Virtual Accounts (BCA/BRI/Mandiri)** to simulate Rupiah deposits.
* **Logic:** The smart contract validates these "deposits" to transfer **IDRX** directly to the user's wallet.

### 3. NXS Yield Vault (Savings)
A sustainable yield generation protocol for IDRX holders.
* **Function:** Stake IDRX to earn **Nexus (NXS)** rewards using Epoch-based distribution.

### 4. Treasury Redemption (Off-Ramp)
A guaranteed exit strategy for yield farmers.
* **Function:** Burn earned NXS rewards to receive **USDC** instantly.
* **Valuation:** Backed by a **Governance-Adjustable On-Chain Rate** (e.g., 1 NXS ≈ $0.02 USDC).

---

## 🔗 Ecosystem Integration

Santara Protocol is built on top of the existing **Santara Ecosystem**. It seamlessly integrates with legacy assets via interfaces:
* **Wrapped SAN (wSAN):** Supports bridging from existing assets.
* **Santara DEX:** Used for liquidity routing reference.
* **Direct Swap Contract:** Acts as the gateway between the new IDRX ecosystem and legacy assets.
> *Note: The wSAN token and DEX contracts reside in a separate repository and are interacted with via Interfaces (`IWrappedSantaraDEX`).*

---

## 📜 Deployed Contracts (Base Sepolia)

| Contract | Address | Description |
| :--- | :--- | :--- |
| **Santara Direct Swap** | [`0x...`](https://sepolia.basescan.org/address/0xdC14c4C650624668c0C92300511191f8F9fFADdc) | Oracle-based AMM & Fee Manager |
| **IDRX Stablecoin** | [`0x...`](https://sepolia.basescan.org/address/0x76c85Fa1d9D89404692eCcc7F994e8597bca8944) | Fiat-pegged Token (AccessControl) |
| **Fiat Gateway** | [`0x...`](https://sepolia.basescan.org/address/0x04B7306B226734Dc568CBEBB39ab7c4422898F5b) | VA Simulation & Minting Logic |
| **NXS Yield Vault** | [`0x...`](https://sepolia.basescan.org/address/0x8c135bbb87fDDf8cEe6f1338962af4F5399bFcf3) | Staking & Reward Distribution |
| **NXS Redemption** | [`0x...`](https://sepolia.basescan.org/address/0x3aE317d84Ad98c0253f7BE5d09d7A8c8EFa62022) | NXS Burn → USDC Treasury Swap |
| **Nexus Token (NXS)** | [`0x...`](https://sepolia.basescan.org/address/0xaF7D0B1128914D295c808774Eb752f8c3F982960) | Reward Token on Vault |

---

## 🏗️ Technical Architecture & Setup Flow

The system is deployed in a specific order to ensure dependency resolution:
`Smart Contracts` → `Oracle Bot` → `Oracle Relay` → `Oracle Dashboard` → `Frontend UI`

### Prerequisites
* Node.js v18+
* Hardhat
* Docker (Optional for Oracle Services)

---

### 1️⃣ Step 1: Deploy Smart Contracts
*The foundation of the protocol. Deploys IDRX, NXS, Vaults, and the Direct Swap logic.*

```bash
cd contracts
npm install
cp .env.example .env # Configure KEYSTORE_PATH, KEYSTORE_PASSWORD, RPC_URL & ETHERSCAN_API_KEY

# Deploy to Base Sepolia
npx hardhat run scripts/Deploy-IDRX.js --network base
npx hardhat run scripts/Deploy-NXS.js --network base
npx hardhat run scripts/Deploy-SantaraDirectSwap.js --network base
npx hardhat run scripts/Deploy-SantaraFiatSettlementGateway.js --network base
npx hardhat run scripts/Deploy-NXSYield.js --network base
npx hardhat run scripts/Deploy-NXSRedemption.js --network base

```

> **Note:** Save the deployed contract addresses. You will need them for the next steps.

---

### 2️⃣ Step 2: Initialize Oracle Bot (Signer)

*The background service that fetches prices from Indodax and signs the data.*

```bash
cd oracle/bot
npm install
cp .env.example .env 
# Configure:
# - CONTRACT_ADDRESS
# - KEYSTORE_PASSWORD
# - KEYSTORE_PATH

node index.js

```
---

### 3️⃣ Step 3: Start Oracle Relay (API Gateway)

*The HTTP Server that exposes the signed data to the Frontend.*

```bash
cd oracle/relay
pip install fastapi "uvicorn[standard]" requests slowapi cachetools
uvicorn relay:app --host 0.0.0.0 --port 40865

```

*The Relay is now serving `GET /public/price` on port 40865.*

---

### 4️⃣ Step 4: Launch Oracle Dashboard (Monitoring)

*A visual interface to monitor the Oracle's health, heartbeat, and historic data.*

```bash
cd oracle/dashboard
npm install
npm run dev

```

*Access the dashboard at `http://localhost:4932`. It connects to the Relay API.*

---

### 5️⃣ Step 5: Launch Santara Frontend (DApp)

*The user-facing application for Swapping, Staking, and Bridging.*

```bash
cd frontend
npm install

# Update src/config.js with:
# - New Contract Addresses (from Step 1)
# - Oracle Relay URL (from Step 3)
# - coinbase developer api key & reown id

npm run dev

```

*The Protocol is now live at `http://localhost:8065`!*

---

## 🛡️ Security Mechanisms

### Oracle Circuit Breaker

* **Problem:** If the Oracle Bot (Step 2) crashes, the price becomes stale.
* **Solution:** The Smart Contract (Step 1) enforces a `MAX_DELAY` (e.g., 1 hour). If `block.timestamp - lastUpdate > MAX_DELAY`, all swaps **REVERT** immediately.

### Precision Handling

* **Problem:** 1 ETH = ~52,000,000 IDR. Standard math causes overflow.
* **Solution:** A strict **"Multiply before Divide"** logic and a `SCALE` constant () normalize the Indodax feeds before EVM processing.

---

## 🏆 Hackathon Submission

**Built for Base Hackathon 2026.**
*Focus Area: DeFi, Real World Assets (RWA) & Emerging Markets.*

**License:** MIT

```
