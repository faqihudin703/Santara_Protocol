# 🇮🇩 Santara Protocol

**A Decentralized Rupiah (IDRX) Ecosystem on Base Chain.**

> *Bridging real-world Indonesian market rates to DeFi via custom Oracle infrastructure.*

![License](https://img.shields.io/badge/License-MIT-green.svg)
![Network](https://img.shields.io/badge/Network-Base%20Sepolia-blue)
![Status](https://img.shields.io/badge/Status-Live%20Beta-orange)

## 📖 Overview

**Santara Protocol** is a suite of decentralized finance (DeFi) products designed to bring the Indonesian Rupiah (IDR) on-chain. It solves the friction of high-fee "double conversion" (IDR → USD → ETH) by allowing direct swaps between ETH and a Rupiah-pegged stablecoin (**IDRX**) using real-time market data.

This repository contains the core Smart Contracts and the Custom Oracle Node service.

## 🏗️ Architecture

The protocol consists of three main pillars:

1.  **Santara Direct Swap (Oracle-Powered):**
    Allows users to swap `ETH` or `wSAN` directly to `IDRX`. Unlike traditional AMMs, it uses an off-chain Oracle to fetch the real `ETH/IDR` price from **Indodax** (a leading local exchange), ensuring zero-spread manipulation.

2.  **IDRX Stablecoin:**
    A compliant, AccessControl-protected stablecoin pegged 1:1 to IDR.

3.  **NXS Yield Vault:**
    A staking contract where users can deposit `IDRX` to earn yield in **Nexus (NXS)** tokens. It utilizes an **Epoch-based reward distribution** logic (inspired by Synthetix) to ensure sustainable liquidity mining.

---

## 🔗 Ecosystem Integration

Santara Protocol is built on top of the existing **Santara Terminal Ecosystem**. It seamlessly integrates with legacy assets via interfaces:

* **Wrapped SAN (wSAN):** Supports bridging from existing assets.
* **Santara DEX:** Used for liquidity routing reference.
* **Direct Swap Contract:** Acts as the gateway between the new IDRX ecosystem and legacy assets.

> *Note: The wSAN token and DEX contracts reside in a separate repository and are interacted with via Interfaces (`IWrappedSantaraDEX`).*

---

## 🛡️ Oracle Security Mechanism

We implemented a robust **Heartbeat & Circuit Breaker** system to prevent "stale price" attacks:

1.  **Off-Chain Bot (Node.js):**
    * Fetches price from Indodax API every 15-20 minutes.
    * **Sanity Check:** Discards outliers (e.g., if price drops 90% instantly) to prevent flash crashes.
    * **Security:** Uses encrypted Keystore JSON (no raw private keys in `.env`).

2.  **On-Chain (Solidity):**
    * **Time-Lock Check:** The `swapEthForIDRX` function checks `block.timestamp - lastUpdate`.
    * **Circuit Breaker:** If the price hasn't been updated for **> 1 Hour**, the contract automatically **REVERTS** all swaps. This protects users from trading against stale data if the bot goes offline.

---

## 📜 Deployed Contracts (Base Sepolia)

| Contract | Address | Status |
| :--- | :--- | :--- |
| **Santara Direct Swap** | [`0x...`](https://sepolia.basescan.org/address/0xdC14c4C650624668c0C92300511191f8F9fFADdc) | ✅ Verified |
| **IDRX Stablecoin** | [`0x...`](https://sepolia.basescan.org/address/0x76c85Fa1d9D89404692eCcc7F994e8597bca8944) | ✅ Verified |
| **NXS Yield Vault** | [`0x...`](https://sepolia.basescan.org/address/0x8c135bbb87fDDf8cEe6f1338962af4F5399bFcf3) | ✅ Verified |
| **Nexus Token (NXS)** | [`0x...`](https://sepolia.basescan.org/address/0xaF7D0B1128914D295c808774Eb752f8c3F982960) | ✅ Verified |

---

## ⚙️ Getting Started

### Prerequisites

* Node.js v18+
* Docker (Optional, for Oracle Bot)
* Hardhat

### 1. Installation

```bash
git clone [https://github.com/faqihudin703/Santara_Protocol.git](https://github.com/faqihudin703/Santara_Protocol.git)
cd santara-protocol
npm install

```

### 2. Environment Setup

Create a `.env` file:

```ini
RPC_URL=[https://sepolia.base.org](https://sepolia.base.org)
PRIVATE_KEY=your_deployer_key
ETHERSCAN_API_KEY=your_basescan_key

```

### 3. Deploy Contracts

```bash
# Deploy entire ecosystem
npx hardhat run scripts/Deploy-IDRX.js --network base
npx hardhat run scripts/Deploy-NXS.js --network base
npx hardhat run scripts/Deploy-SantaraDirectSwap.js --network base
npx hardhat run scripts/Deploy-NXSYield.js --network base

```

### 4. Running the Oracle Bot

Navigate to the bot directory:

```bash
cd oracle-bot
npm install
node index.js

```

*The bot will start fetching Indodax prices and pushing updates to the blockchain automatically.*

---

## 🛠️ Tech Stack

* **Smart Contracts:** Solidity 0.8.20, OpenZeppelin Upgradeable.
* **Backend:** Node.js, Ethers.js, Axios.
* **Infrastructure:** Docker, Base Sepolia Testnet.

---

## 🏆 Hackathon Submission

Built for **Base Hackathon 2026**.
*Focus Area: DeFi & Real World Assets (RWA).*

---

**License:** MIT
