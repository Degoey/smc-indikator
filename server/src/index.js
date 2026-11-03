import { createServer } from "node:http"
import { URL } from "node:url"
import config from "./config.js"
import * as marketData from "./indodax/marketData.js"
import * as orders from "./indodax/orders.js"
import { startBot, stopBot } from "./bot.js"

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const LEVEL = LOG_LEVELS[config.logLevel] ?? 1

const PROXY_PREFIX = "/proxy/indodax"

function log(level, message, context = {}) {
  if (LOG_LEVELS[level] < LEVEL) return
  const ts = new Date().toISOString()
  console.log(JSON.stringify({ timestamp: ts, level: level.toUpperCase(), message, context }))
}

function isOriginAllowed(origin) {
  const allowed = config.server.corsOrigin.split(",").map((s) => s.trim())
  if (allowed.includes("*")) return true
  // Android/iOS WebView (Capacitor) commonly sends these origins:
  const webviewOrigins = ["capacitor://localhost", "http://localhost", "https://localhost", "ionic://localhost", "null"]
  if (webviewOrigins.includes(origin)) return true
  if (!origin) return true
  return allowed.includes(origin)
}

function setCorsHeaders(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin || config.server.corsOrigin.split(",")[0].trim())
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

const PROXY_ROUTES = {
  ticker: (pair) => `/api/ticker/${pair}`,
  pairs: () => "/api/pairs",
  summaries: () => "/api/summaries",
  depth: (pair) => `/api/depth/${pair}`,
  trades: (pair) => `/api/trades/${pair}`,
}

const TIMEFRAME_SECONDS = {
  1: 60,
  15: 900,
  30: 1800,
  60: 3600,
  240: 14400,
  "1D": 86400,
  "3D": 259200,
  "1W": 604800,
}

function resolveProxyPath(pathname) {
  const parts = pathname.slice(PROXY_PREFIX.length + 1).split("/").filter(Boolean)
  const resource = parts[0]
  const pair = parts[1]
  const build = PROXY_ROUTES[resource]
  if (!build) return null
  const needsPair = resource !== "pairs" && resource !== "summaries"
  if (needsPair && !pair) return null
  return build(pair)
}

function normalizeOhlcSymbol(symbol) {
  return String(symbol).replace(/_/g, "").toUpperCase()
}

function getTimeframeSeconds(tf) {
  const key = String(tf)
  return TIMEFRAME_SECONDS[key] ?? null
}

function buildOhlcQuery(symbol, tf, from, to) {
  const tfSeconds = getTimeframeSeconds(tf)
  if (!tfSeconds) {
    throw new Error(`Unsupported timeframe: ${tf}`)
  }

  const now = Math.floor(Date.now() / 1000)
  const resolvedTo = to ? Number(to) : now
  const resolvedFrom = from ? Number(from) : resolvedTo - 200 * tfSeconds

  const query = new URLSearchParams({
    from: String(resolvedFrom),
    to: String(resolvedTo),
    symbol: normalizeOhlcSymbol(symbol),
    tf: String(tfSeconds),
  }).toString()

  return { path: `/tradingview/history_v2?${query}`, tfSeconds }
}

async function fetchIndodaxPublic(pathname) {
  const url = `${config.indodax.publicBaseUrl}${pathname}`
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(config.indodax.timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Indodax upstream error ${response.status} for ${pathname}`)
  }

  return response.json()
}

async function handleProxy(req, res, upstreamPath) {
  const data = await fetchIndodaxPublic(upstreamPath)
  sendJson(res, 200, data)
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = ""
    req.on("data", (chunk) => (data += chunk))
    req.on("end", () => {
      try {
        resolve(JSON.parse(data))
      } catch {
        resolve({})
      }
    })
    req.on("error", reject)
  })
}

async function handleHealth(req, res) {
  sendJson(res, 200, { status: "ok" })
}

async function handleMarketTicker(req, res, pair) {
  const data = await marketData.getTicker(pair)
  sendJson(res, 200, data)
}

async function handleMarketDepth(req, res, pair) {
  const data = await marketData.getDepth(pair)
  sendJson(res, 200, data)
}

async function handleAccount(req, res) {
  const data = await orders.getAccountInfo()
  sendJson(res, 200, data)
}

async function handleCreateOrder(req, res) {
  const body = await parseBody(req)
  const { symbol, side, type, price, quantity, quoteOrderQty } = body || {}
  if (!symbol || !side || !type) {
    return sendJson(res, 400, { error: "symbol, side, and type are required" })
  }

  if (config.bot.dryRun) {
    return sendJson(res, 200, { dryRun: true, intended: body })
  }

  let result
  if (String(type).toUpperCase() === "LIMIT") {
    if (price === undefined || quantity === undefined) {
      return sendJson(res, 400, { error: "LIMIT order requires price and quantity" })
    }
    result = await orders.placeLimitOrder({ symbol, side, price, quantity, clientOrderId: body.clientOrderId })
  } else if (String(type).toUpperCase() === "MARKET") {
    result = await orders.placeMarketOrder({ symbol, side, quoteOrderQty })
  } else {
    return sendJson(res, 400, { error: "Unsupported order type" })
  }
  sendJson(res, 200, result)
}

async function handleDeleteOrder(req, res) {
  const body = await parseBody(req)
  const { symbol, orderId } = body || {}
  if (!symbol || !orderId) {
    return sendJson(res, 400, { error: "symbol and orderId are required" })
  }
  const result = await orders.cancelOrder({ symbol, orderId })
  sendJson(res, 200, result)
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (!isOriginAllowed(origin)) {
    sendJson(res, 403, { error: "Origin not allowed" })
    return
  }
  setCorsHeaders(res, origin)

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const method = req.method
  const path = url.pathname

  try {
    if (path.startsWith(`${PROXY_PREFIX}/`) && method === "GET") {
      const ohlcParts = path.slice(`${PROXY_PREFIX}/`.length).split("/")
      if (ohlcParts[0] === "ohlc" && ohlcParts.length >= 3) {
        const symbol = ohlcParts[1]
        const tf = ohlcParts[2]
        const { from, to } = Object.fromEntries(url.searchParams.entries())
        const { path: upstreamPath } = buildOhlcQuery(symbol, tf, from, to)
        await handleProxy(req, res, upstreamPath)
      } else {
        const upstreamPath = resolveProxyPath(path)
        if (!upstreamPath) {
          sendJson(res, 404, { error: "Not found" })
        } else {
          await handleProxy(req, res, upstreamPath)
        }
      }
    } else if (path === "/health" && method === "GET") {
      await handleHealth(req, res)
    } else if (path.startsWith("/api/market/") && path.endsWith("/ticker") && method === "GET") {
      const pair = path.split("/")[3]
      await handleMarketTicker(req, res, pair)
    } else if (path.startsWith("/api/market/") && path.endsWith("/depth") && method === "GET") {
      const pair = path.split("/")[3]
      await handleMarketDepth(req, res, pair)
    } else if (path === "/api/account" && method === "GET") {
      await handleAccount(req, res)
    } else if (path === "/api/order" && method === "POST") {
      await handleCreateOrder(req, res)
    } else if (path === "/api/order" && method === "DELETE") {
      await handleDeleteOrder(req, res)
    } else {
      sendJson(res, 404, { error: "Not found" })
    }
  } catch (err) {
    log("error", "Request error", { path, method, error: err.message })
    sendJson(res, 500, { error: err.message })
  }
})

server.listen(config.server.port, () => {
  log("info", "Server listening", { port: config.server.port })
  if (config.bot.enabled) {
    startBot(config.trading.pair).catch((err) => {
      log("error", "Failed to start bot", { error: err.message })
    })
  }
})

process.on("SIGINT", () => {
  stopBot()
  server.close(() => process.exit(0))
})

process.on("SIGTERM", () => {
  stopBot()
  server.close(() => process.exit(0))
})