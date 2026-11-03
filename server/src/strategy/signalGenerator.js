/**
 * Port murni Node.js dari heuristik SMC di `src/lib/smcAutoAnalyzer.js`.
 * Menghasilkan sinyal trading yang siap dipakai oleh `evaluateSetup`.
 */

const PIVOT_WINDOW = 3

function isBullishCandle(c) {
  return c.close >= c.open
}

function isBearishCandle(c) {
  return c.close < c.open
}

function computeAtr(candles, period = 14) {
  if (!candles || candles.length < 2) return 0
  const trs = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const p = candles[i - 1]
    const highLow = c.high - c.low
    const highPrev = Math.abs(c.high - p.close)
    const lowPrev = Math.abs(c.low - p.close)
    trs.push(Math.max(highLow, highPrev, lowPrev))
  }
  const len = Math.min(period, trs.length)
  const slice = trs.slice(-len)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

function roundPrice(value, decimals = 2) {
  if (!Number.isFinite(value)) return value
  return Number(value.toFixed(decimals))
}

function detectPivots(candles) {
  const result = { highs: [], lows: [] }
  if (!candles || candles.length < PIVOT_WINDOW * 2 + 1) return result

  for (let i = PIVOT_WINDOW; i < candles.length - PIVOT_WINDOW; i++) {
    const candle = candles[i]
    const window = candles.slice(i - PIVOT_WINDOW, i + PIVOT_WINDOW + 1)

    const isHigh = window.every((c) => c.high <= candle.high)
    const isLow = window.every((c) => c.low >= candle.low)

    if (isHigh) {
      const prev = result.highs[result.highs.length - 1]
      const label = prev ? (candle.high >= prev.price ? "HH" : "LH") : "HH"
      result.highs.push({ index: i, time: candle.time, price: candle.high, label })
    }
    if (isLow) {
      const prev = result.lows[result.lows.length - 1]
      const label = prev ? (candle.low <= prev.price ? "LL" : "HL") : "LL"
      result.lows.push({ index: i, time: candle.time, price: candle.low, label })
    }
  }
  return result
}

function deriveStructureBreaks(highs, lows) {
  const allPivots = [
    ...highs.map((h) => ({ ...h, kind: "high" })),
    ...lows.map((l) => ({ ...l, kind: "low" })),
  ].sort((a, b) => a.index - b.index)

  const events = []
  let trend = "neutral"
  let lastHigh = null
  let lastLow = null

  for (const pivot of allPivots) {
    if (pivot.kind === "high") {
      if (lastHigh !== null && pivot.price > lastHigh.price) {
        events.push({
          type: trend === "up" ? "BOS" : "CHoCH",
          direction: "bullish",
          price: lastHigh.price,
          time: pivot.time,
          index: pivot.index,
        })
        trend = "up"
      }
      lastHigh = pivot
    } else {
      if (lastLow !== null && pivot.price < lastLow.price) {
        events.push({
          type: trend === "down" ? "BOS" : "CHoCH",
          direction: "bearish",
          price: lastLow.price,
          time: pivot.time,
          index: pivot.index,
        })
        trend = "down"
      }
      lastLow = pivot
    }
  }

  return { events, trend, lastHigh, lastLow }
}

function buildLiquidityLevels(candles, count = 4) {
  if (!candles || candles.length === 0) return []

  const sortedHighs = [...candles].sort((a, b) => b.high - a.high).slice(0, Math.max(1, Math.floor(candles.length / 4)))
  const sortedLows = [...candles].sort((a, b) => a.low - b.low).slice(0, Math.max(1, Math.floor(candles.length / 4)))

  const levels = []

  sortedHighs.forEach((c, idx) => {
    if (idx < Math.ceil(count / 2)) {
      levels.push({ price: c.high, time: c.time, label: `Liquidity (EQH) ${idx + 1}`, type: "eqh" })
    }
  })

  sortedLows.forEach((c, idx) => {
    if (idx < Math.floor(count / 2)) {
      levels.push({ price: c.low, time: c.time, label: `Liquidity (EQL) ${idx + 1}`, type: "eql" })
    }
  })

  return levels.slice(0, count)
}

function lastEvent(structure) {
  const events = structure?.events || []
  return events.length > 0 ? events[events.length - 1] : null
}

function findOrderBlock(htfCandles, structure) {
  const evt = lastEvent(structure)
  if (!evt || evt.index == null) return null

  let obCandle = null
  for (let i = evt.index - 1; i >= 0; i--) {
    const c = htfCandles[i]
    if (evt.direction === "bullish" && isBearishCandle(c)) {
      obCandle = c
      break
    }
    if (evt.direction === "bearish" && isBullishCandle(c)) {
      obCandle = c
      break
    }
  }

  if (!obCandle) return null

  return {
    top: Math.max(obCandle.open, obCandle.close),
    bottom: Math.min(obCandle.open, obCandle.close),
    mid: (obCandle.open + obCandle.close) / 2,
  }
}

function findFairValueGap(candles) {
  for (let i = candles.length - 1; i >= 2; i--) {
    const c0 = candles[i - 2]
    const c1 = candles[i - 1]
    const c2 = candles[i]

    if (c2.low > c0.high) {
      return { top: c2.low, bottom: c0.high, mid: (c2.low + c0.high) / 2, type: "bullish", index: i }
    }
    if (c2.high < c0.low) {
      return { top: c0.low, bottom: c2.high, mid: (c0.low + c2.high) / 2, type: "bearish", index: i }
    }
  }
  return null
}

function priceInPoiZone(close, poi, atr) {
  if (!poi) return false
  const tolerance = atr * 0.25
  return close >= poi.bottom - tolerance && close <= poi.top + tolerance
}

function priceEnteredPoiTime(candles, poi) {
  if (!poi) return null
  for (let i = candles.length - 1; i >= 0; i--) {
    const c = candles[i]
    if (c.close >= poi.bottom && c.close <= poi.top) return c.time
  }
  return null
}

function detectSweep(candles, levels) {
  const latest = candles[candles.length - 1]
  const relevant = levels.filter((l) => {
    if (l.type === "eqh") return l.price >= latest.close
    if (l.type === "eql") return l.price <= latest.close
    return false
  })

  if (relevant.length === 0) {
    return { htfCandleRejection: "tidak", level: null, candle: null }
  }

  const level = relevant.reduce((closest, l) =>
    Math.abs(l.price - latest.close) < Math.abs(closest.price - latest.close) ? l : closest
  )

  for (let i = candles.length - 1; i >= Math.max(0, candles.length - 10); i--) {
    const c = candles[i]
    let wickBeyond = false
    let longWick = false

    if (level.type === "eqh") {
      wickBeyond = c.high > level.price
      const upperWick = c.high - Math.max(c.open, c.close)
      const body = Math.abs(c.close - c.open)
      longWick = upperWick > body * 2
    } else {
      wickBeyond = c.low < level.price
      const lowerWick = Math.min(c.open, c.close) - c.low
      const body = Math.abs(c.close - c.open)
      longWick = lowerWick > body * 2
    }

    if (wickBeyond && longWick) {
      return { htfCandleRejection: "ya", level, candle: c }
    }
  }

  return { htfCandleRejection: "tidak", level, candle: null }
}

function findLtfRejection(ltfCandles, poi, atr) {
  if (!poi || !ltfCandles.length) return false
  for (let i = ltfCandles.length - 1; i >= Math.max(0, ltfCandles.length - 20); i--) {
    const c = ltfCandles[i]
    if (priceInPoiZone(c.close, poi, atr * 0.5)) {
      const body = Math.abs(c.close - c.open)
      const upperWick = c.high - Math.max(c.open, c.close)
      const lowerWick = Math.min(c.open, c.close) - c.low
      if (upperWick > body * 2 || lowerWick > body * 2) return true
    }
  }
  return false
}

function findLtfPoiAfterChoch(ltfCandles, chochTime) {
  if (!chochTime || !ltfCandles.length) return false
  for (let i = ltfCandles.length - 1; i >= 2; i--) {
    const c0 = ltfCandles[i - 2]
    const c1 = ltfCandles[i - 1]
    const c2 = ltfCandles[i]
    if (c2.time <= chochTime) continue
    if (c2.low > c0.high || c2.high < c0.low) return true
  }
  return false
}

function nearestSwingLow(candles, fromIndex, count = 5) {
  let low = Infinity
  for (let i = fromIndex; i >= Math.max(0, fromIndex - count); i--) {
    low = Math.min(low, candles[i].low)
  }
  return low === Infinity ? candles[fromIndex].low : low
}

function nearestSwingHigh(candles, fromIndex, count = 5) {
  let high = -Infinity
  for (let i = fromIndex; i >= Math.max(0, fromIndex - count); i--) {
    high = Math.max(high, candles[i].high)
  }
  return high === -Infinity ? candles[fromIndex].high : high
}

/**
 * @param {object} input
 * @param {Array} input.htfCandles
 * @param {Array} input.ltfCandles
 * @param {string} input.symbol
 * @param {number} input.maxRiskPct
 * @returns {null | object}
 */
export function generateSignal({ htfCandles, ltfCandles, symbol, maxRiskPct }) {
  if (!htfCandles || htfCandles.length < 30) return null
  if (!ltfCandles || ltfCandles.length < 30) return null

  const latestHtf = htfCandles[htfCandles.length - 1]
  const atr = computeAtr(htfCandles, 14)

  const htfPivots = detectPivots(htfCandles)
  const htfStructure = deriveStructureBreaks(htfPivots.highs, htfPivots.lows)
  const htfEvent = lastEvent(htfStructure)

  const obZone = findOrderBlock(htfCandles, htfStructure)
  const fvgZone = findFairValueGap(htfCandles)
  const activePoi = obZone || fvgZone

  const poiPriceInZone = priceInPoiZone(latestHtf.close, activePoi, atr)

  const gateChecks = {
    trendAligned: htfStructure.trend !== "neutral" && htfStructure.trend !== null,
    poiPatience: poiPriceInZone,
  }

  const liquidityLevels = buildLiquidityLevels(htfCandles, 4)
  const nearestLevel =
    liquidityLevels.length > 0
      ? liquidityLevels.reduce((closest, l) =>
          Math.abs(l.price - latestHtf.close) < Math.abs(closest.price - latestHtf.close) ? l : closest
        )
      : null

  const sweep = detectSweep(htfCandles, liquidityLevels)
  const poiEnterTime = priceEnteredPoiTime(htfCandles, activePoi)
  let sweepAfterPoi = "tidak"
  if (sweep.candle && poiEnterTime != null && sweep.candle.time >= poiEnterTime) {
    sweepAfterPoi = "ya"
  }

  const ltfPivots = detectPivots(ltfCandles)
  const ltfStructure = deriveStructureBreaks(ltfPivots.highs, ltfPivots.lows)
  const ltfEvents = ltfStructure.events || []
  const ltfChochEvents = ltfEvents.filter((e) => e.type === "CHoCH")
  const latestLtfChoch = ltfChochEvents.length > 0 ? ltfChochEvents[ltfChochEvents.length - 1] : null

  const reaksiHtfPoi = findLtfRejection(ltfCandles, activePoi, atr)
  const chochLtf = latestLtfChoch != null
  const poiLtfBaru = findLtfPoiAfterChoch(ltfCandles, latestLtfChoch?.time)

  let entry = null
  let stopLoss = null
  let takeProfit = null

  if (activePoi) {
    if (htfStructure.trend === "up" || !htfStructure.trend || htfStructure.trend === "neutral") {
      const entryPrice = activePoi.mid
      const slPrice = nearestSwingLow(htfCandles, htfCandles.length - 1, 10) - atr * 0.5
      const tpCandidate = nearestLevel && nearestLevel.type === "eqh" ? nearestLevel.price : entryPrice + (entryPrice - slPrice) * 2.5
      entry = roundPrice(entryPrice)
      stopLoss = roundPrice(slPrice)
      takeProfit = roundPrice(tpCandidate)
    } else if (htfStructure.trend === "down") {
      const entryPrice = activePoi.mid
      const slPrice = nearestSwingHigh(htfCandles, htfCandles.length - 1, 10) + atr * 0.5
      const tpCandidate = nearestLevel && nearestLevel.type === "eql" ? nearestLevel.price : entryPrice - (slPrice - entryPrice) * 2.5
      entry = roundPrice(entryPrice)
      stopLoss = roundPrice(slPrice)
      takeProfit = roundPrice(tpCandidate)
    }
  }

  const tradeDirection = htfStructure.trend === "down" ? "short" : "long"
  let slBreached = false
  let structureFailed = false

  if (entry != null && stopLoss != null) {
    const slNum = Number(stopLoss)
    if (tradeDirection === "long") {
      for (let i = htfCandles.length - 1; i >= 0; i--) {
        if (htfCandles[i].low <= slNum) {
          slBreached = true
          break
        }
      }
    } else {
      for (let i = htfCandles.length - 1; i >= 0; i--) {
        if (htfCandles[i].high >= slNum) {
          slBreached = true
          break
        }
      }
    }

    if (htfEvent) {
      const oppositeEvents = htfStructure.events.filter((e) =>
        tradeDirection === "long" ? e.direction === "bearish" : e.direction === "bullish"
      )
      if (oppositeEvents.length > 0) {
        const lastOpposite = oppositeEvents[oppositeEvents.length - 1]
        if (lastOpposite.time > htfEvent.time && lastOpposite.time <= latestHtf.time) {
          structureFailed = true
        }
      }
    }
  }

  const invalidated = slBreached || structureFailed
  const sweepAllYes = sweep.htfCandleRejection === "ya" && sweepAfterPoi === "ya"
  const checkedCount = [reaksiHtfPoi, chochLtf, poiLtfBaru].filter(Boolean).length
  const gatePassed = gateChecks.trendAligned && gateChecks.poiPatience

  return {
    gatePassed,
    sweepConfirmed: sweepAllYes,
    chochLtf,
    ltfFilterCount: checkedCount,
    invalidated,
    entry: entry ?? 0,
    stopLoss: stopLoss ?? 0,
    takeProfit: takeProfit ?? 0,
    symbol: symbol || "",
    maxRiskPct: maxRiskPct ?? 2,
  }
}


