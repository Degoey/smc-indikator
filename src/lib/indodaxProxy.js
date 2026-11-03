const PROXY_BASE = import.meta.env?.VITE_INDODAX_PROXY_URL || "http://localhost:8787/proxy/indodax"

function normalizeSymbol(symbol) {
  return String(symbol).replace(/_/g, "").toUpperCase()
}

function toPairId(pair) {
  const normalized = String(pair).toLowerCase().replace(/idr$/, "_idr")
  if (!normalized.includes("_")) {
    return normalized
  }
  return normalized
}

export async function fetchOhlc({ symbol, timeframe, from, to }) {
  const tf = String(timeframe)
  const query = new URLSearchParams()
  if (from) query.set("from", String(from))
  if (to) query.set("to", String(to))

  const url = `${PROXY_BASE}/ohlc/${normalizeSymbol(symbol)}/${tf}?${query.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`OHLC fetch failed: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  const data = Array.isArray(payload) ? payload : payload?.data

  if (!Array.isArray(data)) {
    throw new Error("Unexpected OHLC response format")
  }

  const candles = data
    .map((c) => ({
      time: Number(c.Time ?? c.time),
      open: Number(c.Open ?? c.open),
      high: Number(c.High ?? c.high),
      low: Number(c.Low ?? c.low),
      close: Number(c.Close ?? c.close),
      volume: Number(c.Volume ?? c.volume ?? 0),
    }))
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high))
    .sort((a, b) => a.time - b.time)

  return candles
}

export async function fetchTicker(pair) {
  const normalized = toPairId(pair)
  const response = await fetch(`${PROXY_BASE}/ticker/${normalized}`)
  if (!response.ok) {
    throw new Error(`Ticker fetch failed: ${response.status}`)
  }
  return response.json()
}

export async function fetchPairRules(pair) {
  const normalized = toPairId(pair)
  const response = await fetch(`${PROXY_BASE}/pairs`)
  if (!response.ok) {
    throw new Error(`Pairs fetch failed: ${response.status}`)
  }
  const payload = await response.json()
  const key = normalized.toLowerCase()
  const upperKey = normalized.toUpperCase()
  const data = payload && (payload[key] || payload[upperKey])

  if (!data) {
    throw new Error(`Pair ${pair} not found`)
  }

  return {
    pricePrecision: Number.isFinite(data.decimals) ? data.decimals : 0,
    pricescale: Number.isFinite(data.pricescale) ? data.pricescale : 0,
    quantityIncrement: Number.isFinite(data.minimum_qty) ? data.minimum_qty : 0,
    tradeMinBaseCurrency: Number.isFinite(data.minimum_order) ? data.minimum_order : 0,
    tradeMinTradedCurrency: Number.isFinite(data.minimum_traded) ? data.minimum_traded : 0,
    makerFeePct: Number.isFinite(data.maker_fee) ? data.maker_fee : 0,
    takerFeePct: Number.isFinite(data.taker_fee) ? data.taker_fee : 0,
  }
}

export { PROXY_BASE }
