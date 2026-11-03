# Indodax Integration Guide for the SMC Trading Checklist App

This guide documents how to integrate the existing **SMC Trading Checklist App** (Vite + React 19 + Tailwind CSS v4) with the **Indodax** exchange API for automated spot trading. All code examples are written in **Node.js ESM (Node 20+)**.

The companion reference implementation is located under `D:\SMC INDIKATOR\server\`. This guide references those files but does not create or modify them.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Prerequisites & API Key Setup](#2-prerequisites--api-key-setup)
3. [Authentication Protocol](#3-authentication-protocol)
4. [API Endpoint Documentation](#4-api-endpoint-documentation)
5. [Security Architecture](#5-security-architecture)
6. [Implementation Logic (Node.js)](#6-implementation-logic-nodejs)
7. [Error Handling & Resilience](#7-error-handling--resilience)
8. [Testing & Rollout Checklist](#8-testing--rollout-checklist)
9. [Reference File Map](#9-reference-file-map)
10. [Disclaimer](#10-disclaimer)

---

## 1. Overview & Architecture

### 1.1 Purpose

The React application provides an SMC (Smart Money Concepts) analysis checklist: **Initial Gate**, **Liquidity Sweep**, **CHoCH/BOS**, **Lower-Timeframe Confirmation**, and **Order Parameters (Entry / SL / TP)**. This guide adds a server-side execution layer that translates those signals into Indodax spot orders.

### 1.2 High-Level Architecture

```
+-------------------------------------------------------------+
|                    Browser (React App)                      |
|  - Vite + React 19 + Tailwind CSS v4                        |
|  - SMC Checklist: Gate, Sweep, CHoCH, Entry, SL, TP, RR >= 2|
|  - Does NOT store or sign API keys                          |
+-------------------------------------------------------------+
                            |
                            v
              +----------------------------+
              |  Local Node.js Backend     |
              |  /api/indodax/*            |
              +----------------------------+
                            |
        +-------------------+--------------------+
        v                   v                    v
  Public REST         Legacy v1 (tapi)    Trade API v2
https://indodax.com   HMAC-SHA512         https://api.indodax.com
   180 req/min        POST only           HMAC-SHA256
                              |
                              v
                       Indodax Exchange
```

### 1.3 Mandatory Server-Side Signing Boundary

All authenticated requests **MUST** be signed on the server. The browser only communicates with the local backend. Reasons:

1. **Key secrecy**: The `secretKey` is shown only once and must never reach the client.
2. **Signature integrity**: HMAC requires the secret; signing in the browser leaks the key.
3. **CORS & origin lock**: The backend can restrict origins to the local React app.
4. **Audit & retry**: Logging, retries, and state reconciliation run safely on the server.

> **SPOT ONLY**: This guide covers spot trading only. Margin, futures, and other derivatives are out of scope.

---

## 2. Prerequisites & API Key Setup

### 2.1 System Requirements

- Node.js 20 or newer
- npm, yarn, or pnpm
- Stable internet connection
- Verified Indodax account (KYC)
- Static or predictable public IP for whitelisting

### 2.2 Creating an API Key

1. Log in to Indodax at `https://indodax.com`.
2. Navigate to the **Trade API** page: `https://indodax.com/trade_api`.
3. Click **Create New API Key**.
4. Select minimal permissions:
   - **View Only**: read balances and history.
   - **Spot Trading**: create and cancel spot orders.
   - **Do not** enable withdrawal permissions.
5. Enter the whitelisted IP address (mandatory for v2 trading).
6. Save the **API Key** and **Secret Key** securely. The secret is shown only once.
7. For development, create a separate key and use a demo/sandbox environment when available.

### 2.3 Choosing v1 vs v2

| Aspect | Legacy v1 (`/tapi`) | Trade API v2 (`/api/v2`) |
|--------|---------------------|--------------------------|
| Base URL | `https://indodax.com` | `https://api.indodax.com` |
| Algorithm | HMAC-SHA512 | HMAC-SHA256 |
| API Key header | `Key` | `X-APIKEY` |
| Body format | `application/x-www-form-urlencoded` | `application/x-www-form-urlencoded` (POST) or query (GET) |
| Order methods | `trade`, `cancelOrder` | `POST /api/v2/order`, `DELETE /api/v2/order` |
| IP whitelisting | Recommended | Mandatory for trading/withdrawal |
| Status | Active, but some history endpoints were decommissioned | Recommended for new implementations |

**Recommendation**: Use **Trade API v2** for orders and account data, and **Public REST** for market data. Use Legacy v1 only if a specific feature is unavailable in v2.

### 2.4 API Key Permission Matrix

| Permission | Needed for Spot Bot | Risk if Enabled |
|------------|---------------------|-----------------|
| View Only | Yes | Low; read-only balance and history |
| Spot Trading | Yes | Medium; can create/cancel orders |
| IDR Withdrawal | **No** | High; funds can be withdrawn |
| Crypto Withdrawal | **No** | High; assets can be transferred externally |

---

## 3. Authentication Protocol

### 3.1 Legacy v1 (`https://indodax.com/tapi`)

All requests are **POST**. Requests must be signed with HMAC-SHA512.

#### Headers

```text
Key:  <apiKey>
Sign: <HMAC-SHA512 hex>
```

#### Body (form-urlencoded)

```text
method=<method>&nonce=<integer>&param1=value1&param2=value2
```

Or with `timestamp` (milliseconds) and `recvWindow`:

```text
method=<method>&timestamp=<ms>&recvWindow=<ms>
```

#### Signing Pseudocode

```javascript
import crypto from 'node:crypto';

function sortParams(params) {
  return Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
}

export function signV1(secret, payload) {
  const body = new URLSearchParams(sortParams(payload)).toString();
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}
```

#### curl Example

```bash
curl -X POST "https://indodax.com/tapi" \
  -H "Key: YOUR-API-KEY-HERE" \
  -H "Sign: YOUR-HMAC-SHA512-HEX-HERE" \
  -d "method=getInfo&nonce=1714399200000"
```

### 3.2 Trade API v2 (`https://api.indodax.com`)

Headers for v2:

```text
Accept:       application/json
X-APIKEY:     <apiKey>
Sign:         <HMAC-SHA256 hex>
Content-Type: application/x-www-form-urlencoded  (for POST)
```

The signature is computed over the **exact URL-encoded request body/query string** using HMAC-SHA256.

```javascript
import crypto from 'node:crypto';

function sortParams(params) {
  return Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
}

export function signV2(secret, payload) {
  const body = new URLSearchParams(sortParams(payload)).toString();
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}
```

For POST requests, sign the same form-urlencoded body that is sent. For GET requests, sign the complete query string.

#### v2 Example - POST Order

```javascript
import crypto from 'node:crypto';

const API_KEY = process.env.INDODAX_API_KEY;
const API_SECRET = process.env.INDODAX_API_SECRET;

const timestamp = Date.now();
const payload = {
  symbol: 'BTCIDR',
  side: 'BUY',
  type: 'LIMIT',
  price: '150000000',
  quantity: '0.0001',
  newClientOrderId: 'smc-buy-001',
  recvWindow: '5000',
  timestamp: String(timestamp),
};

const sorted = Object.keys(payload)
  .sort()
  .reduce((acc, key) => { acc[key] = payload[key]; return acc; }, {});

const body = new URLSearchParams(sorted).toString();
const sign = crypto.createHmac('sha256', API_SECRET).update(body).digest('hex');

const response = await fetch('https://api.indodax.com/api/v2/order', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-APIKEY': API_KEY,
    'Sign': sign,
  },
  body,
});

const result = await response.json();
console.log(result);
```

#### curl Example

```bash
curl -X POST "https://api.indodax.com/api/v2/order" \
  -H "Accept: application/json" \
  -H "X-APIKEY: YOUR-API-KEY-HERE" \
  -H "Sign: YOUR-HMAC-SHA256-HEX-HERE" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "symbol=BTCIDR&side=BUY&type=LIMIT&price=150000000&quantity=0.0001&recvWindow=5000&timestamp=1714399200000"
```

### 3.3 Authentication Comparison

| Aspect | v1 Legacy | v2 Trade API |
|--------|-----------|--------------|
| Base URL | `https://indodax.com` | `https://api.indodax.com` |
| Algorithm | HMAC-SHA512 | HMAC-SHA256 |
| API Key header | `Key` | `X-APIKEY` |
| Signature header | `Sign` | `Sign` |
| HTTP methods | `POST` only | `GET`, `POST`, `DELETE` |
| Body format | `application/x-www-form-urlencoded` | `application/x-www-form-urlencoded` (POST) or query (GET) |
| Timestamp field | `nonce` or `timestamp` | `timestamp` required |
| recvWindow | Optional | Optional, default 5000 ms |
| Key type | v1 only | v2 only (dedicated) |

### 3.4 Common Pitfalls

1. **Signing raw vs encoded body**: Always sign the exact URL-encoded string that is sent. Differences such as `%20` vs `+` will fail signature validation.
2. **Parameter ordering**: Sort parameters alphabetically before encoding and signing.
3. **Nonce reuse**: `nonce` must always increase. With `timestamp`, keep the server clock synchronized.
4. **Clock skew**: A gap between local time and Indodax time causes `-1021` errors. Sync using `/api/server_time`.
5. **v1/v2 key incompatibility**: v1 keys do not work with v2 endpoints and vice versa.

---

## 4. API Endpoint Documentation

### 4.1 Pair Formats

| Context | Format | Example |
|---------|--------|---------|
| Public ticker/trades/depth | lowercase underscore | `btc_idr` |
| TradingView OHLC | uppercase no underscore | `BTCIDR` |
| Trade API v2 | uppercase no underscore | `BTCIDR` |
| Legacy v1 | lowercase underscore | `btc_idr` |

### 4.2 Precision & Minimums

Use metadata from `GET /api/pairs` to avoid rejected orders:

- `price_precision` / `pricescale`: price precision.
- `quantity_increment`: quantity step size.
- `trade_min_base_currency`: minimum order size in base currency.
- `trade_min_traded_currency`: minimum order size in IDR.

### 4.3 Public REST Endpoints

| Method | Path | Auth | Rate Limit | Purpose | Key Parameters |
|--------|------|------|------------|---------|----------------|
| GET | `/api/server_time` | No | 180/min | Server time | - |
| GET | `/api/pairs` | No | 180/min | Pair metadata | - |
| GET | `/api/price_increments` | No | 180/min | Price increments per pair | - |
| GET | `/api/summaries` | No | 180/min | Market summaries | - |
| GET | `/api/ticker/{pair_id}` | No | 180/min | Single pair ticker | `pair_id` e.g. `btc_idr` |
| GET | `/api/ticker_all` | No | 180/min | All tickers | - |
| GET | `/api/trades/{pair_id}` | No | 180/min | Public trade history | `pair_id` |
| GET | `/api/depth/{pair_id}` | No | 180/min | Order book | `pair_id` |
| GET | `/tradingview/history_v2` | No | 180/min | OHLC data | `from`, `to`, `symbol`, `tf` |

Supported OHLC timeframes: `1`, `15`, `30`, `60`, `240`, `1D`, `3D`, `1W`.

### 4.4 Account Endpoints

| Method | Path | Auth | Rate Limit | Purpose |
|--------|------|------|------------|---------|
| POST | `/tapi` (`method=getInfo`) | v1 | 20/s | Balances, holds, server time |
| GET | `/api/v2/account` | v2 | 300/min | Balances and permissions |

### 4.5 Order Execution Endpoints

| Method | Path | Auth | Rate Limit | Purpose | Key Parameters |
|--------|------|------|------------|---------|----------------|
| POST | `/tapi` (`method=trade`) | v1 | 20/s per pair | Create order | `pair`, `type`, `price`, `idr`/`<coin>`, `order_type`, `client_order_id` |
| POST | `/api/v2/order` | v2 | 300/min, 20/s per pair | Create order | `symbol`, `side`, `type`, `price`, `quantity`, `quoteOrderQty`, `newClientOrderId` |
| POST | `/tapi` (`method=cancelOrder`) | v1 | 30/s | Cancel order | `pair`, `order_id`, `type` |
| DELETE | `/api/v2/order` | v2 | 300/min, 30/s | Cancel order | `symbol`, `orderId` / `origClientOrderId` |
| POST | `/tapi` (`method=openOrders`) | v1 | 20/s | Open orders | `pair` |
| GET | `/api/v2/openOrders` | v2 | 300/min | Open orders | `symbol` (optional) |
| POST | `/tapi` (`method=getOrder`) | v1 | 20/s | Order details | `pair`, `order_id` |
| GET | `/api/v2/order` | v2 | 300/min | Order details | `symbol`, `orderId` / `origClientOrderId` |
| GET | `/api/v2/order/histories` | v2 | 300/min | Order history | `symbol`, `startTime`, `endTime`, `limit` |
| GET | `/api/v2/myTrades` | v2 | 300/min | Trade history | `symbol`, `startTime`, `endTime`, `limit` |

---

## 5. Security Architecture

### 5.1 Environment Variables

Example `server/.env`:

```bash
# Indodax
INDODAX_API_KEY=YOUR-API-KEY-HERE
INDODAX_API_SECRET=YOUR-API-SECRET-HERE
INDODAX_BASE_URL=https://api.indodax.com
INDODAX_PUBLIC_URL=https://indodax.com

# Server
PORT=3001
NODE_ENV=production
CORS_ORIGIN=http://localhost:5173

# Trading
DEFAULT_PAIR=BTCIDR
DRY_RUN=true
MAX_ORDER_IDR=1000000
```

Add `.env` to `server/.gitignore`:

```gitignore
.env
.env.local
*.pem
node_modules/
dist/
```

### 5.2 API Key Security Rules

- **Never send keys to the browser**. The browser only talks to the backend.
- **Least privilege**: enable only View + Spot Trading. Disable withdrawal.
- **IP whitelisting**: restrict the key to the bot server's IP.
- **Rotate keys** regularly and after any security incident.
- **Encrypt at rest**: store secrets in a KMS or use envelope encryption.
- **Do not log signatures**: redact `Sign` and secret values before logging.

### 5.3 Header Redaction Example

```javascript
function redactHeaders(headers) {
  const redacted = { ...headers };
  if (redacted.Sign) redacted.Sign = '***REDACTED***';
  if (redacted['X-APIKEY']) redacted['X-APIKEY'] = '***REDACTED***';
  return redacted;
}
```

### 5.4 Idempotency & Kill Switch

Use unique `client_order_id` / `newClientOrderId` values to prevent duplicate orders.

Implement a **kill switch** so the bot stops placing new orders and cancels open orders when:

- Consecutive losses exceed a threshold.
- Repeated authentication or rate-limit errors occur.
- A manual stop signal is received.

---

## 6. Implementation Logic (Node.js)

### 6.1 Configuration Loading & Validation

```javascript
// src/config.js
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

dotenvConfig({ path: resolve(process.cwd(), '.env') });

const required = ['INDODAX_API_KEY', 'INDODAX_API_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  apiKey: process.env.INDODAX_API_KEY,
  apiSecret: process.env.INDODAX_API_SECRET,
  baseUrl: process.env.INDODAX_BASE_URL || 'https://api.indodax.com',
  publicUrl: process.env.INDODAX_PUBLIC_URL || 'https://indodax.com',
  port: Number(process.env.PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  defaultPair: process.env.DEFAULT_PAIR || 'BTCIDR',
  dryRun: process.env.DRY_RUN === 'true',
  maxOrderIdr: Number(process.env.MAX_ORDER_IDR || 1_000_000),
};
```

### 6.2 Signature Module

```javascript
// src/indodax/signature.js
import crypto from 'node:crypto';

function sortParams(params) {
  return Object.keys(params)
    .sort()
    .reduce((acc, key) => { acc[key] = params[key]; return acc; }, {});
}

export function signV1(secret, payload) {
  const body = new URLSearchParams(sortParams(payload)).toString();
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

export function signV2(secret, payload) {
  const body = new URLSearchParams(sortParams(payload)).toString();
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}
```

### 6.3 HTTP Client

```javascript
// src/indodax/client.js
import { config } from '../config.js';
import { signV2 } from './signature.js';

const DEFAULT_TIMEOUT = 10_000;

export class IndodaxClient {
  constructor(apiKey = config.apiKey, apiSecret = config.apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = config.baseUrl;
  }

  async request(path, options = {}) {
    const { method = 'GET', params = {}, body = null, timeout = DEFAULT_TIMEOUT } = options;
    const url = new URL(path, this.baseUrl);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const headers = { Accept: 'application/json', 'X-APIKEY': this.apiKey };
    let requestBody = undefined;

    if (body && Object.keys(body).length > 0) {
      const payload = { ...body, timestamp: String(Date.now()), recvWindow: '5000' };
      requestBody = new URLSearchParams(sortParams(payload)).toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers.Sign = signV2(this.apiSecret, payload);
    } else if (method !== 'GET') {
      const payload = { timestamp: String(Date.now()), recvWindow: '5000' };
      requestBody = new URLSearchParams(sortParams(payload)).toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers.Sign = signV2(this.apiSecret, payload);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.code < 0 || data.success === 0) {
        const err = new Error(data.msg || data.error || `HTTP ${response.status}`);
        err.code = data.code;
        err.status = response.status;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async getAccount() {
    return this.request('/api/v2/account');
  }

  async placeOrder(order) {
    return this.request('/api/v2/order', { method: 'POST', body: order });
  }

  async cancelOrder({ symbol, orderId, origClientOrderId }) {
    const body = { symbol };
    if (orderId) body.orderId = orderId;
    if (origClientOrderId) body.origClientOrderId = origClientOrderId;
    return this.request('/api/v2/order', { method: 'DELETE', body });
  }

  async getOpenOrders(symbol) {
    return this.request('/api/v2/openOrders', { params: symbol ? { symbol } : {} });
  }
}

function sortParams(params) {
  return Object.keys(params)
    .sort()
    .reduce((acc, key) => { acc[key] = params[key]; return acc; }, {});
}
```

### 6.4 Token-Bucket Rate Limiter

```javascript
// src/indodax/rateLimiter.js
export class RateLimiter {
  constructor({ capacity, refillPerSecond, name = 'limiter' }) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerSecond = refillPerSecond;
    this.lastRefill = Date.now();
    this.name = name;
    this.waiters = [];
    this._refillInterval = setInterval(() => this.refill(), 1000);
  }

  refill() {
    const now = Date.now();
    const added = ((now - this.lastRefill) / 1000) * this.refillPerSecond;
    this.tokens = Math.min(this.capacity, this.tokens + added);
    this.lastRefill = now;
  }

  async acquire() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      setTimeout(() => this._processWaiters(), 50);
    });
  }

  _processWaiters() {
    this.refill();
    while (this.waiters.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      this.waiters.shift()();
    }
    if (this.waiters.length > 0) {
      setTimeout(() => this._processWaiters(), 50);
    }
  }

  destroy() {
    clearInterval(this._refillInterval);
  }
}

export const publicRateLimiter = new RateLimiter({ capacity: 180, refillPerSecond: 3, name: 'public' });
export const tradeRateLimiter = new RateLimiter({ capacity: 20, refillPerSecond: 20, name: 'trade' });
export const cancelRateLimiter = new RateLimiter({ capacity: 30, refillPerSecond: 30, name: 'cancel' });
```

### 6.5 Market Data Module

```javascript
// src/indodax/marketData.js
import { config } from '../config.js';

const PUBLIC_URL = config.publicUrl;

export async function getServerTime() {
  const res = await fetch(`${PUBLIC_URL}/api/server_time`);
  return res.json();
}

export async function getPairs() {
  const res = await fetch(`${PUBLIC_URL}/api/pairs`);
  return res.json();
}

export async function getTicker(pairId) {
  const res = await fetch(`${PUBLIC_URL}/api/ticker/${pairId}`);
  return res.json();
}

export async function getDepth(pairId) {
  const res = await fetch(`${PUBLIC_URL}/api/depth/${pairId}`);
  return res.json();
}

export async function getOhlcv({ symbol, from, to, tf }) {
  const url = `${PUBLIC_URL}/tradingview/history_v2?from=${from}&symbol=${symbol}&tf=${tf}&to=${to}`;
  const res = await fetch(url);
  return res.json();
}
```

### 6.6 Orders Module

```javascript
// src/indodax/orders.js
import { IndodaxClient } from './client.js';
import { tradeRateLimiter, cancelRateLimiter } from './rateLimiter.js';

const client = new IndodaxClient();

export async function placeLimitOrder({ symbol, side, price, quantity, clientOrderId }) {
  await tradeRateLimiter.acquire();
  return client.placeOrder({
    symbol,
    side,
    type: 'LIMIT',
    price: String(price),
    quantity: String(quantity),
    newClientOrderId: clientOrderId,
    timeInForce: 'GTC',
  });
}

export async function placeMarketBuy({ symbol, quoteOrderQty, clientOrderId }) {
  await tradeRateLimiter.acquire();
  return client.placeOrder({
    symbol,
    side: 'BUY',
    type: 'MARKET',
    quoteOrderQty: String(quoteOrderQty),
    newClientOrderId: clientOrderId,
  });
}

export async function cancelOrderByClientId(symbol, origClientOrderId) {
  await cancelRateLimiter.acquire();
  return client.cancelOrder({ symbol, origClientOrderId });
}

export async function getOpenOrders(symbol) {
  return client.getOpenOrders(symbol);
}
```

### 6.7 SMC Strategy Validation

```javascript
// src/strategy/smcStrategy.js
export function evaluateSMCSetup({
  gate,
  sweep,
  choch,
  entry,
  stopLoss,
  takeProfit,
  ltfConfirmation,
}) {
  if (!gate || !sweep || !choch || !ltfConfirmation) {
    return { valid: false, reason: 'SMC preconditions not met' };
  }
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  if (risk <= 0) {
    return { valid: false, reason: 'Invalid stop loss distance' };
  }
  const rr = reward / risk;
  if (rr < 2) {
    return { valid: false, reason: `RR too low: ${rr.toFixed(2)}` };
  }
  return { valid: true, rr };
}
```

### 6.8 Position Sizing

```javascript
// src/strategy/positionSizing.js
export function computeOrderSize({
  balanceIdr,
  riskPercent,
  entryPrice,
  stopLossPrice,
  maxOrderIdr,
}) {
  const riskAmount = balanceIdr * (riskPercent / 100);
  const priceDistance = Math.abs(entryPrice - stopLossPrice) / entryPrice;
  const notional = riskAmount / priceDistance;
  const capped = Math.min(notional, maxOrderIdr);
  return {
    idrAmount: Math.floor(capped),
    quantity: Number((capped / entryPrice).toFixed(8)),
  };
}
```

### 6.9 End-to-End Bot Flow

```javascript
// src/bot.js
import { getServerTime, getOhlcv } from './indodax/marketData.js';
import { IndodaxClient } from './indodax/client.js';
import { evaluateSMCSetup } from './strategy/smcStrategy.js';
import { computeOrderSize } from './strategy/positionSizing.js';
import { placeLimitOrder } from './indodax/orders.js';
import { config } from './config.js';

export async function runCycle(setup) {
  // 1. Clock sync
  const { server_time: serverTime } = await getServerTime();
  const skew = Date.now() - serverTime;
  if (Math.abs(skew) > 1000) {
    console.warn(`Clock skew detected: ${skew}ms`);
  }

  // 2. Validate SMC preconditions
  const smc = evaluateSMCSetup(setup);
  if (!smc.valid) {
    console.log('Skipping cycle:', smc.reason);
    return { action: 'skip', reason: smc.reason };
  }

  // 3. Check balance
  const client = new IndodaxClient();
  const account = await client.getAccount();
  const idrBalance = account.balances.find((b) => b.asset === 'IDR');
  if (!idrBalance || Number(idrBalance.free) <= 0) {
    return { action: 'skip', reason: 'Insufficient IDR balance' };
  }

  // 4. Fetch OHLCV
  const now = Math.floor(Date.now() / 1000);
  const from = now - 86400;
  const ohlcv = await getOhlcv({
    symbol: config.defaultPair,
    from,
    to: now,
    tf: '15',
  });
  console.log('OHLCV candles fetched:', ohlcv.length);

  // 5. Size the order
  const sizing = computeOrderSize({
    balanceIdr: Number(idrBalance.free),
    riskPercent: 1,
    entryPrice: setup.entry,
    stopLossPrice: setup.stopLoss,
    maxOrderIdr: config.maxOrderIdr,
  });
  if (sizing.idrAmount <= 0) {
    return { action: 'skip', reason: 'Zero or negative order size' };
  }

  // 6. Place order (or dry run)
  if (config.dryRun) {
    console.log('[DRY RUN] Would place order:', sizing);
    return { action: 'dry-run', sizing };
  }

  const order = await placeLimitOrder({
    symbol: config.defaultPair,
    side: 'BUY',
    price: setup.entry,
    quantity: sizing.quantity,
    clientOrderId: `smc-${Date.now()}`,
  });

  return { action: 'placed', order };
}
```

### 6.10 Strategy Loop & Graceful Shutdown

```javascript
// src/index.js
import { runCycle } from './bot.js';

let isRunning = true;
let timeoutId = null;

async function tick() {
  try {
    const result = await runCycle({
      gate: true,
      sweep: true,
      choch: true,
      entry: 150_000_000,
      stopLoss: 148_000_000,
      takeProfit: 154_000_000,
      ltfConfirmation: true,
    });
    console.log('Tick result:', result);
  } catch (err) {
    console.error('Tick error:', err.message);
  }

  if (isRunning) {
    timeoutId = setTimeout(tick, 60_000);
  }
}

function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  isRunning = false;
  if (timeoutId) clearTimeout(timeoutId);
  setTimeout(() => process.exit(0), 2_000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

tick();
```

---

## 7. Error Handling & Resilience

### 7.1 Error Code Mapping

| Code / Error | Cause | Recommended Action |
|--------------|-------|--------------------|
| `-1001` | Internal Indodax error | Retry with backoff |
| `-1002` | Invalid credentials | Check API key/secret, stop bot |
| `-1021` | Timestamp outside recvWindow | Sync clock with `/api/server_time` |
| `-1022` | Invalid nonce/signature | Verify parameter ordering and encoding |
| `-1102` | Missing or malformed parameter | Validate payload |
| `1109` | Invalid parameter value | Check precision and minimums |
| `-1121` | Invalid symbol | Verify pair format |
| `-1130` | Trading rule violation | Check order size and price |
| `-1111` | Quantity validation failed | Round to `quantity_increment` |
| `-2010` | Order rejected (insufficient balance / duplicate client order ID) | Check balance and idempotency |
| `-2014` | API key not found in header | Verify `X-APIKEY` header |
| `-2015` | Access denied / unauthorized IP | Verify IP whitelist |
| `-1003` / `too_many_requests` | Rate limit exceeded | Backoff 5 seconds, reduce throughput |
| `success=0` (v1) | Legacy v1 error | Read `error` and `error_code` |

### 7.2 Retry Policy

```javascript
export async function withRetry(fn, { maxAttempts = 3, baseDelay = 500 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.status >= 500 || err.code === '-1001' || err.code === '-1003';
      if (!isRetryable || attempt === maxAttempts) throw err;
      const delay = baseDelay * 2 ** attempt + Math.random() * 300;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

### 7.3 Clock Skew Detection

```javascript
import { getServerTime } from './indodax/marketData.js';

export async function syncClock() {
  const { server_time: serverTime } = await getServerTime();
  const local = Date.now();
  const skew = local - serverTime;
  if (Math.abs(skew) > 1000) {
    console.warn(`Clock skew: ${skew}ms. Adjust timestamp logic.`);
  }
  return { serverTime, local, skew };
}
```

### 7.4 Circuit Breaker

```javascript
export class CircuitBreaker {
  constructor({ failureThreshold = 5, resetTimeoutMs = 60_000 }) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.failures = 0;
    this.nextAttempt = Date.now();
    this.state = 'CLOSED';
  }

  async run(fn) {
    if (this.state === 'OPEN' && Date.now() < this.nextAttempt) {
      throw new Error('Circuit breaker is OPEN');
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
    }
  }
}
```

### 7.5 Reconciling Local State

Treat the exchange as the source of truth. Before placing an order:

1. Fetch open orders via `GET /api/v2/openOrders`.
2. Check recent trade history via `GET /api/v2/myTrades`.
3. Use a unique `newClientOrderId` to avoid duplicates.
4. On partial fills, re-evaluate remaining quantity before adding exposure.

---

## 8. Testing & Rollout Checklist

### 8.1 Demo Environment

- Use `demo-indodax.com` or test keys when available.
- Run with `DRY_RUN=true` until all flows are verified.

### 8.2 Staged Testing

| Step | Action | Success Criteria |
|------|--------|------------------|
| 1 | Ping `/api/server_time` | Server time returned in milliseconds |
| 2 | GET `/api/v2/account` | Balances read without auth error |
| 3 | Place a tiny live order | Order appears in `openOrders` |
| 4 | Cancel the order | Order no longer open |
| 5 | Run bot for 24 hours | No fatal errors, rate limits respected |

### 8.3 Pre-Production Checklist

- [ ] `.env` is listed in `.gitignore`
- [ ] API key has minimal permissions (View + Spot Trading)
- [ ] Withdrawal permission is **disabled**
- [ ] Server IP is whitelisted
- [ ] `DRY_RUN` has been thoroughly tested
- [ ] Kill switch / dead-man switch is implemented
- [ ] Logs redact signatures and secrets
- [ ] Alerting is configured for fatal errors and rate limits
- [ ] Rollback procedure is documented

---

## 9. Reference File Map

This guide references the following files under `D:\SMC INDIKATOR\server\`:

| File | Purpose |
|------|---------|
| `server/package.json` | Dependencies, start/build scripts, ESM configuration |
| `server/.env.example` | Environment template without real secrets |
| `server/src/config.js` | Load and validate environment variables |
| `server/src/indodax/signature.js` | HMAC-SHA512 (v1) and HMAC-SHA256 (v2) signing |
| `server/src/indodax/client.js` | Authenticated HTTP client for Indodax v2 |
| `server/src/indodax/rateLimiter.js` | Token-bucket limiters for public/trade/cancel |
| `server/src/indodax/marketData.js` | Public market data wrappers |
| `server/src/indodax/orders.js` | Place, cancel, and query orders |
| `server/src/strategy/smcStrategy.js` | Validate SMC preconditions (gate, sweep, CHoCH, RR) |
| `server/src/strategy/positionSizing.js` | Risk-based position sizing |
| `server/src/bot.js` | End-to-end flow from signal to order placement |
| `server/src/index.js` | Entry point, loop, graceful shutdown |

---

## 10. Disclaimer

This guide is provided for educational and technical documentation purposes only. Integrating with the Indodax API involves real financial risk. There is no guarantee of profit, and the user is fully responsible for every order executed. Always comply with [Indodax Terms of Service](https://indodax.com) and applicable Indonesian regulations.

---

## Assumptions & Sources

- Official Indodax API documentation: `https://github.com/btcid/indodax-official-api-docs`
- Indodax Trade API key page: `https://indodax.com/trade_api`
- All endpoints and rate limits are based on the official Indodax API docs at the time of writing.
