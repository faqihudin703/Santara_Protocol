import time
import requests
import uuid
import sqlite3
import threading 
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from cachetools import TTLCache

# ───────────────── CONFIG ─────────────────

ORACLE_INTERNAL_URL = "http://localhost:29600/oracle/health"

BIND_HOST = "0.0.0.0"
BIND_PORT = 40865

DB_FILE = "oracle_history.db"
MAX_HISTORY_LIMIT = 25

TRUSTED_ORIGINS = [
    "http://localhost:4932",
]

MIN_UPDATE_INTERVAL = 300

REQUEST_TIMEOUT = 5  # seconds

PRICE_DEVIATION_THRESHOLD_PERCENT = 0.6
HEARTBEAT_INTERVAL_SECONDS = 8 * 60
DB_LOCK = threading.Lock()

# ───────────────── DATABASE MANAGER ─────────────────

def init_db():
    try:
        with DB_LOCK:
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS prices
                         (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                          price REAL, 
                          timestamp INTEGER)''')
            conn.commit()
            conn.close()
            print(f"✅ [DB] Database initialized.")
    except Exception as e:
        print(f"❌ [DB] Init failed: {e}")

def process_price_update(new_price):
    if not isinstance(new_price, (int, float)): return
    
    with DB_LOCK:
        try:
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            
            c.execute("SELECT id, price, timestamp FROM prices ORDER BY id ASC")
            rows = c.fetchall()
            now = int(time.time())
            
            should_insert = False
            
            if len(rows) < 2:
                if len(rows) == 1:
                    last_ts = rows[0][2]
                    if (now - last_ts) > 2: should_insert = True
                else:
                    should_insert = True
            
            else:
                prev_id, prev_price, prev_ts = rows[0]
                curr_id, curr_price, curr_ts = rows[1]
                
                if abs(curr_price - new_price) > 1:
                    should_insert = True
                    
                elif (now - curr_ts) >= MIN_UPDATE_INTERVAL:
                    should_insert = True
            
            if should_insert:
                c.execute("INSERT INTO prices (price, timestamp) VALUES (?, ?)", (new_price, now))
                
                c.execute("""
                    DELETE FROM prices 
                    WHERE id NOT IN (
                        SELECT id FROM prices ORDER BY id DESC LIMIT 2
                    )
                """)
                conn.commit()
            
            conn.close()
        except Exception as e:
            print(f"⚠️ [DB] Save failed: {e}")

def get_previous_price_snapshot():
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("SELECT price FROM prices ORDER BY id ASC")
        rows = c.fetchall()
        conn.close()
        
        if len(rows) == 2:
            return rows[0][0]
        elif len(rows) == 1:
            return rows[0][0]
        
        return None
    except:
        return None

init_db()

def smart_key_func(request: Request):
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    
    is_trusted = False
    
    if origin and any(trusted in origin for trusted in TRUSTED_ORIGINS):
        is_trusted = True
    elif referer and any(trusted in referer for trusted in TRUSTED_ORIGINS):
        is_trusted = True
        
    if is_trusted:
        return str(uuid.uuid4())
    
    return get_remote_address(request)

# ───────────────── APP ─────────────────

app = FastAPI(
    title="Santara Oracle Public Relay",
    description="Public-facing relay exposing oracle price trust metrics",
    version="1.0.0"
)

# ───────────────── CORS ─────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=TRUSTED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ───────────────── RATE LIMIT ─────────────────

limiter = Limiter(key_func=smart_key_func)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(_req, _exc):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests"}
    )

# ───────────────── CACHE ─────────────────

oracle_cache = TTLCache(maxsize=10, ttl=5)

# ───────────────── MIDDLEWARE ─────────────────

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cache-Control"] = "no-store"
    return response

# ───────────────── HELPERS ─────────────────

def safe_number(v):
    return v if isinstance(v, (int, float)) else None

def reject_bad_agent(request: Request):
    ua = request.headers.get("user-agent", "")
    if not ua or len(ua.strip()) < 5:
        raise HTTPException(status_code=403, detail="Invalid client")

GLOBAL_CACHE = {
    "data": None,
    "last_success_ts": 0
}

def fetch_oracle():
    global GLOBAL_CACHE
    
    try:
        target_url = str(ORACLE_INTERNAL_URL).strip()
        
        with requests.Session() as s:
            s.trust_env = False 
            
            resp = s.get(target_url, timeout=REQUEST_TIMEOUT)
        
        if resp.status_code == 200:
            data = resp.json()
            if "last_oracle_price" in data:
                GLOBAL_CACHE["data"] = data
                GLOBAL_CACHE["last_success_ts"] = time.time()
                return data
            
    except Exception as e:
        print(f"⚠️ [RELAY] Oracle connection failed: {e}")
        pass
    
    if GLOBAL_CACHE["data"]:
        print(f"⚠️ [RELAY] Serving STALE data")
        
        stale_data = GLOBAL_CACHE["data"].copy()
        stale_data["price_state"] = "stale (cached)"
        time_diff = int(time.time() - GLOBAL_CACHE["last_success_ts"])
        stale_data["latency_seconds"] = stale_data.get("latency_seconds", 0) + time_diff
        return stale_data

    return None

def format_idr(value):
    if not isinstance(value, (int, float)):
        return None
    return f"Rp {int(value):,}".replace(",", ".")

# ───────────────── ENDPOINTS ─────────────────

@app.get("/")
@limiter.limit("10/minute")
def root(request: Request):
    reject_bad_agent(request)
    return {
        "service": "santara-oracle-relay",
        "status": "running"
    }

@app.get("/public/price")
@limiter.limit("20/minute")
def public_price(request: Request, background_tasks: BackgroundTasks):
    reject_bad_agent(request)

    data = fetch_oracle()
    if not data:
        raise HTTPException(status_code=503, detail="Oracle unavailable")
    
    current_price = data.get("last_oracle_price", 0)
    background_tasks.add_task(process_price_update, current_price)
    
    prev_snapshot = get_previous_price_snapshot()
    prev_final = prev_snapshot if prev_snapshot is not None else current_price
    diff = current_price - prev_final

    return {
        "pair": "ETH/IDR",
        "price_idr": current_price,
        "formatted_price": format_idr(current_price),
        "previous_price": prev_final,
        "price_change": diff,
        "is_up": diff > 0,
        "is_down": diff < 0,
        "is_neutral": diff == 0,
        "price_age_seconds": data.get("latency_seconds", 0),
        "price_state": data.get("price_state", "unknown"),
        "source": "Indodax",
        "aggregation": "midpoint"
    }

@app.get("/public/health")
@limiter.limit("30/minute")
def public_health(request: Request):
    reject_bad_agent(request)
    now = int(time.time())

    data = fetch_oracle()
    if not data:
        raise HTTPException(status_code=503, detail="Oracle unavailable")

    return {
        "oracle_status": data.get("status", "offline"),
        "oracle_score": data.get("score", 0),
        "price_state": data.get("price_state", "unknown"),
        "latency_seconds": data.get("latency_seconds", 0),
        "last_checked": now
    }

@app.get("/public/metrics")
@limiter.limit("10/minute")
def public_metrics(request: Request):
    reject_bad_agent(request)

    data = fetch_oracle()
    if not data:
        raise HTTPException(status_code=503, detail="Oracle unavailable")

    return {
        "avg_deviation_percent": data.get("avg_deviation_percent", 0),
        "max_deviation_percent": data.get("max_deviation_percent", 0),
        "price_deviation_threshold_percent": PRICE_DEVIATION_THRESHOLD_PERCENT,
        "heartbeat_interval_seconds": HEARTBEAT_INTERVAL_SECONDS,
        "total_price_checks": data.get("checks", 0)
    }