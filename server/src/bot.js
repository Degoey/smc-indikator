import config from "./config.js"
import * as marketData from "./indodax/marketData.js"
import * as orders from "./indodax/orders.js"
import { evaluateSetup } from "./strategy/smcStrategy.js"
import { calculatePositionSize } from "./strategy/positionSizing.js"
import { generateSignal } from "./strategy/signalGenerator.js"

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const LEVEL = LOG_LEVELS[config.logLevel] ?? 1

/** @type {ReturnType<typeof setTimeout> | null} */
let loopTimeout = null
let isRunning = false
let isShuttingDown = false
let lastClockSkewCheck = 0
const botOrderIds = new Set()

function log(level, message, context = {}) {
  if (LOG_LEVELS[level] < LEVEL) return
  const redacted = redactContext(context)
  const ts = new Date().toISOString()
  console.log(JSON.stringify({ timestamp: ts, level: level.toUpperCase(), message, context: redacted }))
}

function redactContext(context) {
  const out = {}
  for (const [key, value] of Object.entries(context)) {
    if (/secret|key|signature|sign|password|token/i.test(key)) {
      out[key] = "***"
    } else {
      out[key] = value
    }
  }
  return out
}



async function checkClockSkewOnce() {
  try {
    const { skew } = await marketData.checkClockSkew()
    log("info", "Clock skew check", { skewMs: skew })
    lastClockSkewCheck = Date.now()
  } catch (err) {
    log("warn", "Clock skew check failed", { error: err.message })
  }
}

async function reconcileOpenOrders(symbol) {
  try {
    const result = await orders.getOpenOrders(symbol)
    const openOrders = Array.isArray(result) ? result : (result && result.data) || []
    log("info", "Reconciled open orders", { count: openOrders.length, symbol })
    return openOrders
  } catch (err) {
    log("warn", "Failed to reconcile open orders", { error: err.message, retryable: err.retryable })
    return []
  }
}

const HTF_TIMEFRAME = "240"
const LTF_TIMEFRAME = "15"
const OHLC_CANDLE_COUNT = 200

/**
 * Fetch OHLC candles and map them into the shape expected by `generateSignal`.
 */
async function fetchCandles(symbol, timeframe) {
  const tfSeconds = {
    1: 60,
    15: 900,
    30: 1800,
    60: 3600,
    240: 14400,
    "1D": 86400,
  }[String(timeframe)]

  if (!tfSeconds) throw new Error(`Unsupported timeframe: ${timeframe}`)

  const now = Math.floor(Date.now() / 1000)
  const from = now - OHLC_CANDLE_COUNT * tfSeconds

  const payload = await marketData.getOhlcHistory({
    symbol,
    timeframe,
    from: String(from),
    to: String(now),
  })

  const data = Array.isArray(payload) ? payload : payload?.data
  if (!Array.isArray(data)) return []

  return data
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
}

/**
 * Build a trading signal from live Indodax OHLC data using SMC heuristics.
 * Returns `null` when no signal can be generated (insufficient data or error).
 */
async function getSignal(symbol) {
  try {
    const [htfCandles, ltfCandles] = await Promise.all([
      fetchCandles(symbol, HTF_TIMEFRAME),
      fetchCandles(symbol, LTF_TIMEFRAME),
    ])

    const signal = generateSignal({
      htfCandles,
      ltfCandles,
      symbol,
      maxRiskPct: config.trading.maxRiskPct,
    })

    if (!signal) return null

    let balanceIdr = 0
    try {
      const bal = await orders.getBalance("idr")
      const free = Number(bal?.free ?? 0)
      const locked = Number(bal?.locked ?? 0)
      if (Number.isFinite(free)) balanceIdr += free
      if (Number.isFinite(locked)) balanceIdr += locked
    } catch (err) {
      log("warn", "Failed to fetch IDR balance; signal skipped", { error: err.message })
      return null
    }

    return { ...signal, balanceIdr }
  } catch (err) {
    log("warn", "Signal generation failed", { symbol, error: err.message })
    return null
  }
}

async function cycle(symbol) {
  if (isShuttingDown) return

  if (Date.now() - lastClockSkewCheck > config.bot.clockSkewIntervalMs) {
    await checkClockSkewOnce()
  }

  await reconcileOpenOrders(symbol)

  const signal = await getSignal(symbol)
  if (!signal) {
    log("info", "No trading signal; waiting")
    scheduleNext(symbol)
    return
  }

  const setup = evaluateSetup({
    gatePassed: signal.gatePassed,
    sweepConfirmed: signal.sweepConfirmed,
    chochLtf: signal.chochLtf,
    ltfFilterCount: signal.ltfFilterCount,
    invalidated: signal.invalidated,
    entry: signal.entry,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
  })

  if (setup.action === "CANCEL") {
    log("info", "Strategy decision: CANCEL", { reason: setup.reason, side: setup.side })
    if (!config.bot.dryRun) {
      for (const orderId of botOrderIds) {
        try {
          await orders.cancelOrder({ symbol, orderId })
        } catch (err) {
          log("warn", "Failed to cancel bot order on CANCEL decision", { orderId, error: err.message })
        }
      }
      botOrderIds.clear()
    }
    scheduleNext(symbol)
    return
  }

  if (setup.action === "WAIT") {
    log("info", "Strategy decision: WAIT", { reason: setup.reason, side: setup.side })
    scheduleNext(symbol)
    return
  }

  const pairRules = await marketData.getPairRules(symbol).catch(() => ({}))
  const sizing = calculatePositionSize({
    balanceIdr: signal.balanceIdr,
    maxRiskPct: config.trading.maxRiskPct,
    entry: setup.entry,
    stopLoss: setup.stopLoss,
    pairRules,
  })

  if ("reason" in sizing) {
    log("warn", "Position sizing blocked", { reason: sizing.reason })
    scheduleNext(symbol)
    return
  }

  const clientOrderId = `smc-bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  if (config.bot.dryRun) {
    log("info", "DRY_RUN: would place limit order", {
      symbol,
      side: setup.side,
      entry: setup.entry,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
      quantity: sizing.quantity,
      clientOrderId,
    })
  } else {
    try {
      const order = await orders.placeLimitOrder({
        symbol,
        side: setup.side,
        price: setup.entry,
        quantity: sizing.quantity,
        clientOrderId,
      })
      botOrderIds.add(order.orderId || order.id || clientOrderId)
      log("info", "Limit order placed", { orderId: order.orderId || order.id, clientOrderId })
    } catch (err) {
      log("error", "Failed to place limit order", { error: err.message, retryable: err.retryable })
    }
  }

  scheduleNext(symbol)
}

function scheduleNext(symbol) {
  if (isShuttingDown) return
  loopTimeout = setTimeout(() => {
    cycle(symbol).catch((err) => {
      log("error", "Uncaught cycle error", { error: err.message })
      scheduleNext(symbol)
    })
  }, config.bot.intervalMs)
}

export async function startBot(symbol = config.trading.pair) {
  if (isRunning) return
  isRunning = true
  log("info", "Bot started", { symbol, dryRun: config.bot.dryRun, enabled: config.bot.enabled })
  if (!config.bot.dryRun) {
    log("warn", "Bot is NOT in dry-run mode. Real orders may be placed.", { symbol })
  }
  await cycle(symbol)
}

export function stopBot() {
  isShuttingDown = true
  if (loopTimeout) {
    clearTimeout(loopTimeout)
    loopTimeout = null
  }
  isRunning = false
  log("info", "Bot stopped")
}

async function gracefulShutdown() {
  stopBot()
  if (config.bot.cancelOnShutdown && botOrderIds.size > 0) {
    log("info", "Cancelling outstanding bot orders on shutdown", { count: botOrderIds.size })
    for (const orderId of botOrderIds) {
      try {
        await orders.cancelOrder({ symbol: config.trading.pair, orderId })
      } catch (err) {
        log("warn", "Failed to cancel order during shutdown", { orderId, error: err.message })
      }
    }
    botOrderIds.clear()
  }
}

process.on("SIGINT", async () => {
  log("info", "SIGINT received, shutting down gracefully")
  await gracefulShutdown()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  log("info", "SIGTERM received, shutting down gracefully")
  await gracefulShutdown()
  process.exit(0)
})
