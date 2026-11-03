# SMC Indikator Server

Self-contained Node.js reference implementation for integrating with the Indodax exchange API.
The frontend never holds API keys; this small server proxies signed requests so secrets stay on the server.

## Quickstart

```bash
cd server
cp .env.example .env
# Edit .env and add your API keys
npm start
```

Use `npm run dev` to start with Node.js built-in file watcher.

## Verification

```bash
npm run check   # syntax check every .js file
npm run smoke   # pure-module smoke tests
```

## Safety Warnings

- **Start with `DRY_RUN=true`**. Only set `DRY_RUN=false` AND `BOT_ENABLED=true` after testing.
- Use an API key with **read-only + trade** permission. **Disable withdrawal permission**.
- Whitelist your server IP in the Indodax API dashboard.
- Test on `demo-indodax.com` (or the Indodax demo environment) before using real funds.
- Never commit the `.env` file.

## Architecture

- `src/index.js` – dependency-free `node:http` proxy + optional bot runner.
- `src/indodax/` – API client, signature helpers, rate limiter, market data, and orders.
- `src/strategy/` – pure functions mirroring the SMC checklist (strategy + position sizing).
- `src/bot.js` – automated loop with DRY_RUN support and graceful shutdown.

The browser talks to `http://localhost:8787` (or your deployed server), never to Indodax directly. The server signs requests server-side and forwards them to Indodax.

## API facts

- **v1**: HMAC-SHA512 at `https://indodax.com/tapi` with `Key` and `Sign` headers.
- **v2**: HMAC-SHA256 at `https://api.indodax.com` with `X-APIKEY` and `Sign` headers (requires a dedicated v2 API key).
- Public rate limit: 180 requests/minute.
- Trade rate limit: 20 requests/second per pair; breaching it triggers a 5-second block.
- `tradeHistory`/`orderHistory` v1 endpoints were decommissioned on April 7 2026 in favor of `/api/v2/myTrades` and `/api/v2/order/histories`.

> Always verify the latest official Indodax API documentation before deploying with real funds. The base URL, headers, and signature algorithm can change.

## Endpoints

- `GET /health`
- `GET /api/market/:pair/ticker`
- `GET /api/market/:pair/depth`
- `GET /api/account`
- `POST /api/order`
- `DELETE /api/order`