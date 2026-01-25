import "dotenv/config";
import { ethers } from "ethers";
import axios from "axios";
import express from "express";
import Database from "better-sqlite3";
import fs from "fs";

/* ───────────────── CONFIG ───────────────── */

const {
  RPC_URL,
  CONTRACT_ADDRESS,
  API_URL = "https://indodax.com/api/ticker/ethidr",
  KEYSTORE_PATH,
  KEYSTORE_PASSWORD,
  METRICS_BIND = "0.0.0.0",
  METRICS_PORT = 29600,
  DB_PATH = "./oracle.db"
} = process.env;

const ABI = ["function updateEthToIdrPrice(uint256 newPrice) external"];

const MIN_PRICE = 10_000_000;
const MAX_PRICE = 200_000_000;

const CHECK_INTERVAL_MS = 5_000;
const HEARTBEAT_SEC = 15 * 60;
const FORCE_PUSH_DIFF = 0.006;
const TX_TIMEOUT_MS = 180_000;

/* ───────────────── DATABASE ───────────────── */

const db = new Database(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;

  CREATE TABLE IF NOT EXISTS oracle_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS oracle_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER,
    oracle_price INTEGER,
    midpoint INTEGER,
    deviation REAL
  );

  DELETE FROM oracle_metrics
  WHERE ts < (strftime('%s','now') * 1000) - 604800000;
`);

const getState = k => {
  const r = db.prepare("SELECT value FROM oracle_state WHERE key=?").get(k);
  return r ? JSON.parse(r.value) : null;
};

const setState = (k, v) =>
  db.prepare(`
    INSERT INTO oracle_state (key,value)
    VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(k, JSON.stringify(v));

/* ───────────────── STATE ───────────────── */

let wallet, contract;
let lastPushedPrice = getState("lastPushedPrice");
let lastPushBlockTs = getState("lastPushBlockTs");
let nextPushBlockTs = getState("nextPushBlockTs");
let lastNonce = getState("lastNonce");
let pendingTx = getState("pendingTx");

/* ───────────────── WALLET ───────────────── */

async function initWallet() {
  const json = fs.readFileSync(KEYSTORE_PATH, "utf8");
  const w = await ethers.Wallet.fromEncryptedJson(json, KEYSTORE_PASSWORD);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  wallet = w.connect(provider);
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  const onChainNonce = await provider.getTransactionCount(wallet.address, "latest");
  if (lastNonce === null || lastNonce < onChainNonce) {
    lastNonce = onChainNonce;
    setState("lastNonce", lastNonce);
  }

  console.log("✅ Wallet:", wallet.address, "Next Nonce:", lastNonce);
}

/* ───────────────── FETCH PRICE ───────────────── */

async function fetchPrice() {
  const res = await axios.get(API_URL, { timeout: 5000 });
  const t = res.data?.ticker;
  if (!t) throw new Error("Invalid API response");

  const last = +t.last;
  const buy = +t.buy;
  const sell = +t.sell;

  if ([last, buy, sell].some(Number.isNaN)) throw new Error("NaN price");
  if (last < MIN_PRICE || last > MAX_PRICE) throw new Error("Price out of bounds");

  return { last, midpoint: Math.round((buy + sell) / 2) };
}

/* ───────────────── CORE LOOP ───────────────── */

async function runLoop() {
  try {
    await updatePriceLogic();
  } catch (e) {
    console.warn("⚠️ loop error:", e.message);
  } finally {
    setTimeout(runLoop, CHECK_INTERVAL_MS);
  }
}

async function updatePriceLogic() {
  const provider = wallet.provider;
  const block = await provider.getBlock("latest");
  const blockTs = block.timestamp;

  /* ───── Pending TX handling ───── */
  if (pendingTx) {
    console.log("⏳ [TX] Checking pending transaction...", {
      hash: pendingTx.hash,
      nonce: pendingTx.nonce,
      price: pendingTx.price,
    });
    
    const receipt = await provider.getTransactionReceipt(pendingTx.hash);
    
    if (!receipt) {
      console.log("🕐 [TX] Receipt not found yet, still pending", {
        hash: pendingTx.hash,
      });
      return;
    }

    console.log("📄 [TX] Receipt found", {
      hash: pendingTx.hash,
      status: receipt.status,
      blockNumber: receipt.blockNumber,
    });

    if (receipt?.status === 1) {
      console.log("✅ [TX] Transaction SUCCESS", {
        hash: pendingTx.hash,
        price: pendingTx.price,
        blockTs,
      });
      
      lastPushedPrice = pendingTx.price;
      lastPushBlockTs = blockTs;
      nextPushBlockTs = blockTs + HEARTBEAT_SEC;

      setState("lastPushedPrice", lastPushedPrice);
      setState("lastPushBlockTs", lastPushBlockTs);
      setState("nextPushBlockTs", nextPushBlockTs);

      lastNonce = pendingTx.nonce + 1;
      setState("lastNonce", lastNonce);

      pendingTx = null;
      setState("pendingTx", null);
      
      console.log("💾 [STATE] Updated after SUCCESS", {
        lastPushedPrice,
        lastPushBlockTs,
        nextPushBlockTs,
        lastNonce,
      });
      
      return;
    }

    if (receipt?.status === 0) {
      console.warn("❌ [TX] Transaction FAILED", {
        hash: pendingTx.hash,
        nonce: pendingTx.nonce,
        blockNumber: receipt.blockNumber,
      });

      lastNonce = pendingTx.nonce + 1;
      setState("lastNonce", lastNonce);
      pendingTx = null;
      setState("pendingTx", null);
      
      console.log("💾 [STATE] Updated after FAILURE", {
        lastNonce,
      });
      
      return;
    }

    const timePending = Date.now() - pendingTx.sentAt;
    if (timePending > TX_TIMEOUT_MS) {
      const chainNonce = await provider.getTransactionCount(wallet.address, "latest");

      if (chainNonce > pendingTx.nonce) {
        lastNonce = chainNonce;
        setState("lastNonce", lastNonce);
        pendingTx = null;
        setState("pendingTx", null);
        return;
      }

      await pushPrice(pendingTx.price, true);
    }
    return;
  }

  /* ───── Price eval ───── */
  const { last, midpoint } = await fetchPrice();

  if (!nextPushBlockTs) {
    nextPushBlockTs = blockTs + HEARTBEAT_SEC;
    setState("nextPushBlockTs", nextPushBlockTs);
  }

  let shouldPush = false;

  if (!lastPushedPrice) shouldPush = true;
  else {
    const diff = Math.abs(last - lastPushedPrice) / lastPushedPrice;
    if (diff >= FORCE_PUSH_DIFF) shouldPush = true;
    if (blockTs >= nextPushBlockTs) shouldPush = true;
  }

  const oracleMetricPrice =
    shouldPush || !lastPushedPrice ? last : lastPushedPrice;

  recordMetrics(midpoint, oracleMetricPrice);

  if (shouldPush) await pushPrice(last, false);
}

/* ───────────────── TX PUSH ───────────────── */

async function pushPrice(price, isReplacement = false) {
  const provider = wallet.provider;
  const fee = await provider.getFeeData();

  let maxFeePerGas = fee.maxFeePerGas ?? fee.gasPrice;
  let maxPriorityFeePerGas =
    fee.maxPriorityFeePerGas ?? ethers.parseUnits("2.5", "gwei");

  if (isReplacement && pendingTx?.maxFeePerGas) {
    maxFeePerGas = (BigInt(pendingTx.maxFeePerGas) * 120n) / 100n;
    maxPriorityFeePerGas =
      (BigInt(pendingTx.maxPriorityFeePerGas) * 120n) / 100n;
  }

  const priceInt = BigInt(Math.floor(price));
  const nonce = lastNonce;

  try {
    const tx = await contract.updateEthToIdrPrice(priceInt, {
      nonce,
      maxFeePerGas,
      maxPriorityFeePerGas
    });

    pendingTx = {
      hash: tx.hash,
      nonce,
      price,
      sentAt: Date.now(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
    };

    setState("pendingTx", pendingTx);
    console.log("📡 Tx:", tx.hash, "nonce:", nonce);
  } catch (err) {
    if (err.code === "NONCE_EXPIRED" || err.message?.includes("nonce")) {
      lastNonce = await provider.getTransactionCount(wallet.address, "latest");
      setState("lastNonce", lastNonce);
    } else {
      throw err;
    }
  }
}

/* ───────────────── METRICS ───────────────── */

function recordMetrics(midpoint, oraclePrice) {
  const deviation =
    midpoint && oraclePrice
      ? Math.abs(oraclePrice - midpoint) / midpoint
      : null;

  db.prepare(`
    INSERT INTO oracle_metrics (ts, oracle_price, midpoint, deviation)
    VALUES (?,?,?,?)
  `).run(Date.now(), oraclePrice, midpoint, deviation);
}

/* ───────────────── EXPRESS API ───────────────── */

const app = express();

app.get("/oracle/health", async (_req, res) => {
  if (!wallet) {
    return res.status(503).json({ status: "starting" });
  }

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS checks,
      AVG(deviation) AS avg_dev,
      MAX(deviation) AS max_dev
    FROM oracle_metrics
  `).get();

  const block = await wallet.provider.getBlock("latest");

  const hasPushed = typeof lastPushBlockTs === "number";
  const latency = hasPushed
    ? block.timestamp - lastPushBlockTs
    : null;

  /* ───── Latency penalty ───── */
  let latencyPenalty = 0;
  if (latency !== null && latency > HEARTBEAT_SEC + 40) {
    latencyPenalty = Math.min(
      ((latency - HEARTBEAT_SEC) / 40) * 10,
      40
    );
  }

  /* ───── Deviation penalty ───── */
  const avgDev =
    typeof stats.avg_dev === "number" ? stats.avg_dev : null;

  const deviationPenalty =
    avgDev !== null
      ? Math.min(avgDev * 100 * 10, 30)
      : 0;

  /* ───── Score ───── */
  const score = hasPushed
    ? Math.max(0, Math.round(100 - deviationPenalty - latencyPenalty))
    : 0;

  /* ───── Status ───── */
  const status = !hasPushed
    ? "unknown"
    : latency < HEARTBEAT_SEC
      ? "healthy"
      : score > 60
        ? "degraded"
        : "unhealthy";

  /* ───── Price state ───── */
  const price_state = !hasPushed
    ? "unknown"
    : latency < HEARTBEAT_SEC * 0.7
      ? "fresh"
      : latency < HEARTBEAT_SEC
        ? "aging"
        : "stale";

  res.json({
    status,
    score,
    price_state,
    latency_seconds: latency,
    avg_deviation_percent: avgDev !== null
      ? +(avgDev * 100).toFixed(3)
      : null,
    max_deviation_percent:
      typeof stats.max_dev === "number"
        ? +(stats.max_dev * 100).toFixed(3)
        : null,
    last_oracle_price: lastPushedPrice,
    checks: stats.checks
  });
});

app.listen(METRICS_PORT, METRICS_BIND, () =>
  console.log(`📊 API on ${METRICS_BIND}:${METRICS_PORT}`)
);

/* ───────────────── START ───────────────── */

(async () => {
  await initWallet();
  runLoop();
})();