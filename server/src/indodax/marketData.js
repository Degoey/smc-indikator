import { IndodaxClient } from "./client.js"
import config from "../config.js"

const publicClient = new IndodaxClient({
  apiKey: "",
  secretKey: "",
  version: "v2",
  baseUrl: config.indodax.publicBaseUrl,
  timeoutMs: config.indodax.timeoutMs,
})

export function checkClockSkew() {
  return publicClient.checkClockSkew()
}

export function getServerTime() {
  return publicClient.publicGet("/api/server_time")
}

export function getPairs() {
  return publicClient.publicGet("/api/pairs")
}

export function getTicker(pair) {
  const normalized = String(pair).toLowerCase()
  return publicClient.publicGet(`/api/ticker/${normalized}`)
}

export function getTickerAll() {
  return publicClient.publicGet("/api/ticker")
}

export function getDepth(pair) {
  const normalized = String(pair).toLowerCase()
  return publicClient.publicGet(`/api/depth/${normalized}`)
}

export function getTrades(pair) {
  const normalized = String(pair).toLowerCase()
  return publicClient.publicGet(`/api/trades/${normalized}`)
}

export function getOhlcHistory({ symbol, timeframe = "1H", from, to }) {
  if (!symbol || !from || !to) {
    throw new TypeError("symbol, from, and to are required")
  }
  const pair = String(symbol).toUpperCase()
  const query = new URLSearchParams({
    pair,
    timeframe: String(timeframe),
    from: String(from),
    to: String(to),
  }).toString()
  return publicClient.publicGet(`/tradingview/history_v2?${query}`)
}

export async function getPairRules(pair) {
  const pairs = await getPairs()
  const key = String(pair).toLowerCase()
  const upperKey = String(pair).toUpperCase()
  const data = pairs && (pairs[key] || pairs[upperKey])
  if (!data) {
    throw new Error(`Pair ${pair} not found in /api/pairs`)
  }

  const pricePrecision = Number.isFinite(data.decimals) ? data.decimals : 0
  const pricescale = Number.isFinite(data.pricescale) ? data.pricescale : 0
  const quantityIncrement = Number.isFinite(data.minimum_qty) ? data.minimum_qty : 0
  const tradeMinBaseCurrency = Number.isFinite(data.minimum_order) ? data.minimum_order : 0
  const tradeMinTradedCurrency = Number.isFinite(data.minimum_traded) ? data.minimum_traded : 0
  const makerFeePct = Number.isFinite(data.maker_fee) ? data.maker_fee : 0
  const takerFeePct = Number.isFinite(data.taker_fee) ? data.taker_fee : 0

  return {
    pricePrecision,
    pricescale,
    quantityIncrement,
    tradeMinBaseCurrency,
    tradeMinTradedCurrency,
    makerFeePct,
    takerFeePct,
  }
}
