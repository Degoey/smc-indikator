const PIVOT_WINDOW = 3

function classifyHigh(candle, previousHighs) {
  const previous = previousHighs[previousHighs.length - 1]
  if (!previous) return "HH"
  return candle.high >= previous.price ? "HH" : "LH"
}

function classifyLow(candle, previousLows) {
  const previous = previousLows[previousLows.length - 1]
  if (!previous) return "LL"
  return candle.low <= previous.price ? "LL" : "HL"
}

export function detectPivots(candles) {
  const result = {
    candlesWithPivots: [],
    highs: [],
    lows: [],
  }

  if (!candles || candles.length < PIVOT_WINDOW * 2 + 1) {
    return result
  }

  for (let i = PIVOT_WINDOW; i < candles.length - PIVOT_WINDOW; i++) {
    const candle = candles[i]

    const isHigh = Array.from({ length: PIVOT_WINDOW * 2 + 1 }, (_, idx) => candles[i - PIVOT_WINDOW + idx]).every((c) => c.high <= candle.high)
    const isLow = Array.from({ length: PIVOT_WINDOW * 2 + 1 }, (_, idx) => candles[i - PIVOT_WINDOW + idx]).every((c) => c.low >= candle.low)

    const labelHigh = isHigh ? classifyHigh(candle, result.highs) : null
    const labelLow = isLow ? classifyLow(candle, result.lows) : null

    result.candlesWithPivots.push({
      index: i,
      time: candle.time,
      candle,
      highLabel: labelHigh,
      lowLabel: labelLow,
    })

    if (isHigh) result.highs.push({ index: i, time: candle.time, price: candle.high, label: labelHigh })
    if (isLow) result.lows.push({ index: i, time: candle.time, price: candle.low, label: labelLow })
  }

  return result
}

export function deriveStructureBreaks(highs, lows) {
  const allPivots = [...highs.map((h) => ({ ...h, kind: "high" })), ...lows.map((l) => ({ ...l, kind: "low" }))].sort((a, b) => a.index - b.index)

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

export function buildLiquidityLevels(candles, count = 4) {
  if (!candles || candles.length === 0) return []

  const sortedHighs = [...candles].sort((a, b) => b.high - a.high).slice(0, Math.max(1, Math.floor(candles.length / 4)))
  const sortedLows = [...candles].sort((a, b) => a.low - b.low).slice(0, Math.max(1, Math.floor(candles.length / 4)))

  const levels = []

  sortedHighs.forEach((c, idx) => {
    if (idx < Math.ceil(count / 2)) {
      levels.push({
        price: c.high,
        time: c.time,
        label: `Liquidity (EQH) ${idx + 1}`,
        type: "eqh",
      })
    }
  })

  sortedLows.forEach((c, idx) => {
    if (idx < Math.floor(count / 2)) {
      levels.push({
        price: c.low,
        time: c.time,
        label: `Liquidity (EQL) ${idx + 1}`,
        type: "eql",
      })
    }
  })

  return levels.slice(0, count)
}
