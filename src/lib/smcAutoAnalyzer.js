import { detectPivots, deriveStructureBreaks, buildLiquidityLevels } from "../components/smc/pivots.js"

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
    candle: obCandle,
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
    if (c.close >= poi.bottom && c.close <= poi.top) {
      return c.time
    }
  }
  return null
}

function detectTrendline(pivots) {
  if (!pivots || pivots.length < 3) return false
  const last3 = pivots.slice(-3)
  let ascending = true
  let descending = true
  for (let i = 1; i < last3.length; i++) {
    if (last3[i].price <= last3[i - 1].price) ascending = false
    if (last3[i].price >= last3[i - 1].price) descending = false
  }
  return ascending || descending
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
      if (upperWick > body * 2 || lowerWick > body * 2) {
        return true
      }
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

function buildCancelState(symbol, maxRiskPct, reason) {
  return {
    gateChecks: { trendAligned: false, poiPatience: false },
    initial: { modal: "", maxRisk: String(maxRiskPct ?? "") },
    topDown: {
      assetPair: symbol || "",
      htfTimeframe: "4H",
      structureDirection: "Neutral",
      lastSignal: "BOS",
      ob: false,
      obPrice: "",
      fvg: false,
      fvgPrice: "",
    },
    liquidity: {
      equalHighs: false,
      equalLows: false,
      trendline: false,
      liquidityPrice: "",
      sweepAnswers: { htfCandleRejection: "tidak", sweepAfterPoi: "tidak" },
    },
    ltf: {
      timeframeLtf: "15m",
      reaksiHtfPoi: false,
      chochLtf: false,
      poiLtfBaru: false,
    },
    setup: {
      entry: "",
      stopLoss: "",
      takeProfit: "",
      invalidations: { slBreached: false, structureFailed: false },
    },
    order: { orderType: "buy" },
    finalStatus: { label: "CANCEL", color: "rose", icon: "🔴" },
    explanation: [{ field: "finalStatus", decision: "CANCEL", reason }],
    rr: null,
  }
}

export function analyzeSMC({ htfCandles, ltfCandles, symbol, maxRiskPct }) {
  if (!htfCandles || htfCandles.length < 30) {
    return buildCancelState(symbol, maxRiskPct, "HTF candle data insufficient for analysis")
  }
  if (!ltfCandles || ltfCandles.length < 30) {
    return buildCancelState(symbol, maxRiskPct, "LTF candle data insufficient for analysis")
  }

  const latestHtf = htfCandles[htfCandles.length - 1]
  const atr = computeAtr(htfCandles, 14)

  const htfPivots = detectPivots(htfCandles)
  const htfStructure = deriveStructureBreaks(htfPivots.highs, htfPivots.lows)
  const htfEvent = lastEvent(htfStructure)

  const structureDirection = htfStructure.trend === "up" ? "Bullish" : htfStructure.trend === "down" ? "Bearish" : "Neutral"
  const lastSignal = htfEvent?.type === "CHoCH" ? "CHoCH" : "BOS"

  const obZone = findOrderBlock(htfCandles, htfStructure)
  const fvgZone = findFairValueGap(htfCandles)

  const activePoi = obZone || fvgZone
  const activePoiForPrice = activePoi

  const poiPriceInZone = priceInPoiZone(latestHtf.close, activePoiForPrice, atr)

  const ob = !!obZone
  const fvg = !!fvgZone
  const obPrice = obZone ? roundPrice(obZone.mid) : ""
  const fvgPrice = fvgZone ? roundPrice(fvgZone.mid) : ""

  const gateChecks = {
    trendAligned: htfStructure.trend !== "neutral" && htfStructure.trend !== null,
    poiPatience: poiPriceInZone,
  }

  const liquidityLevels = buildLiquidityLevels(htfCandles, 4)
  const equalHighs = liquidityLevels.some((l) => l.type === "eqh")
  const equalLows = liquidityLevels.some((l) => l.type === "eql")
  const trendline = detectTrendline(htfPivots.highs) || detectTrendline(htfPivots.lows)

  const nearestLevel =
    liquidityLevels.length > 0
      ? liquidityLevels.reduce((closest, l) =>
          Math.abs(l.price - latestHtf.close) < Math.abs(closest.price - latestHtf.close) ? l : closest
        )
      : null

  const sweep = detectSweep(htfCandles, liquidityLevels)

  const poiEnterTime = priceEnteredPoiTime(htfCandles, activePoiForPrice)
  let sweepAfterPoi = "tidak"
  if (sweep.candle && poiEnterTime != null && sweep.candle.time >= poiEnterTime) {
    sweepAfterPoi = "ya"
  }

  const ltfPivots = detectPivots(ltfCandles)
  const ltfStructure = deriveStructureBreaks(ltfPivots.highs, ltfPivots.lows)
  const ltfEvents = ltfStructure.events || []
  const lastLtfEvent = ltfEvents.length > 0 ? ltfEvents[ltfEvents.length - 1] : null

  const ltfChochEvents = ltfEvents.filter((e) => e.type === "CHoCH")
  const latestLtfChoch = ltfChochEvents.length > 0 ? ltfChochEvents[ltfChochEvents.length - 1] : null

  const reaksiHtfPoi = findLtfRejection(ltfCandles, activePoiForPrice, atr)
  const chochLtf = latestLtfChoch != null
  const poiLtfBaru = findLtfPoiAfterChoch(ltfCandles, latestLtfChoch?.time)

  const ltfState = {
    timeframeLtf: "15m",
    reaksiHtfPoi,
    chochLtf,
    poiLtfBaru,
  }

  let entry = ""
  let stopLoss = ""
  let takeProfit = ""
  let orderType = "buy"
  let tradeDirection = "long"

  if (activePoiForPrice) {
    if (htfStructure.trend === "up" || (!htfStructure.trend || htfStructure.trend === "neutral")) {
      tradeDirection = "long"
      orderType = "buy"
      const entryPrice = activePoiForPrice.mid
      const slPrice = nearestSwingLow(htfCandles, htfCandles.length - 1, 10) - atr * 0.5
      const tpCandidate = nearestLevel && nearestLevel.type === "eqh" ? nearestLevel.price : entryPrice + (entryPrice - slPrice) * 2.5
      entry = roundPrice(entryPrice)
      stopLoss = roundPrice(slPrice)
      takeProfit = roundPrice(tpCandidate)
    }

    if (htfStructure.trend === "down") {
      tradeDirection = "short"
      orderType = "sell"
      const entryPrice = activePoiForPrice.mid
      const slPrice = nearestSwingHigh(htfCandles, htfCandles.length - 1, 10) + atr * 0.5
      const tpCandidate = nearestLevel && nearestLevel.type === "eql" ? nearestLevel.price : entryPrice - (slPrice - entryPrice) * 2.5
      entry = roundPrice(entryPrice)
      stopLoss = roundPrice(slPrice)
      takeProfit = roundPrice(tpCandidate)
    }
  }

  let slBreached = false
  let structureFailed = false

  if (entry && stopLoss) {
    const entryNum = Number(entry)
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

  const entryNum = Number(entry)
  const slNum = Number(stopLoss)
  const tpNum = Number(takeProfit)
  let rr = null
  if (entry && stopLoss && takeProfit && slNum !== entryNum) {
    rr = Math.abs(entryNum - tpNum) / Math.abs(entryNum - slNum)
  }

  const sweepAnsweredAll = sweep.htfCandleRejection !== "" && sweepAfterPoi !== ""
  const sweepAllYes = sweep.htfCandleRejection === "ya" && sweepAfterPoi === "ya"
  const sweepStatus = sweepAllYes ? "Sudah Disapu" : "Belum Tersapu"

  const invalidated = slBreached || structureFailed
  const checkedCount = [ltfState.reaksiHtfPoi, ltfState.chochLtf, ltfState.poiLtfBaru].filter(Boolean).length

  let finalStatus = { label: "WAIT", color: "amber", icon: "🟡" }
  if (!gateChecks.trendAligned || !gateChecks.poiPatience || !sweepAllYes || invalidated) {
    finalStatus = { label: "CANCEL", color: "rose", icon: "🔴" }
  } else if (rr && rr >= 2 && checkedCount >= 2 && ltfState.chochLtf) {
    finalStatus = { label: "SET LIMIT ORDER", color: "emerald", icon: "✅" }
  }

  const explanation = [
    {
      field: "gateChecks.trendAligned",
      decision: String(gateChecks.trendAligned),
      reason: gateChecks.trendAligned
        ? `HTF trend detected as ${structureDirection.toLowerCase()}.`
        : "No clear HTF trend; structure is neutral.",
    },
    {
      field: "gateChecks.poiPatience",
      decision: String(gateChecks.poiPatience),
      reason: gateChecks.poiPatience
        ? `Latest HTF close (${latestHtf.close}) is inside or near the detected POI zone.`
        : `Latest HTF close (${latestHtf.close}) is outside the detected POI zone.`,
    },
    {
      field: "topDown.structureDirection",
      decision: structureDirection,
      reason: `Derived from the most recent HTF structure breaks (${htfStructure.events.length} events).`,
    },
    {
      field: "topDown.lastSignal",
      decision: lastSignal,
      reason: `Most recent HTF structure event type is ${lastSignal}.`,
    },
    {
      field: "topDown.ob",
      decision: String(ob),
      reason: ob ? "A recent opposite-colour candle before the impulse was identified as an potential Order Block." : "No clear Order Block identified.",
    },
    {
      field: "topDown.fvg",
      decision: String(fvg),
      reason: fvg ? "A 3-candle Fair Value Gap was detected on the HTF chart." : "No clear Fair Value Gap detected.",
    },
    {
      field: "liquidity.equalHighs",
      decision: String(equalHighs),
      reason: equalHighs ? "Equal highs liquidity level(s) detected." : "No equal highs detected.",
    },
    {
      field: "liquidity.equalLows",
      decision: String(equalLows),
      reason: equalLows ? "Equal lows liquidity level(s) detected." : "No equal lows detected.",
    },
    {
      field: "liquidity.trendline",
      decision: String(trendline),
      reason: trendline ? "A sequence of 3+ pivots suggests a trendline." : "No clear trendline of pivots.",
    },
    {
      field: "liquidity.sweepAnswers.htfCandleRejection",
      decision: sweep.htfCandleRejection,
      reason:
        sweep.htfCandleRejection === "ya"
          ? "A recent HTF candle wicked beyond a liquidity level with a long wick."
          : "No candle with a long rejection wick beyond liquidity was found.",
    },
    {
      field: "liquidity.sweepAnswers.sweepAfterPoi",
      decision: sweepAfterPoi,
      reason:
        sweepAfterPoi === "ya"
          ? "The sweep occurred after price entered the POI zone."
          : "No sweep observed after price entered the POI zone.",
    },
    {
      field: "ltf.reaksiHtfPoi",
      decision: String(ltfState.reaksiHtfPoi),
      reason: ltfState.reaksiHtfPoi
        ? "LTF shows a rejection candle within the HTF POI zone."
        : "No clear LTF rejection at the HTF POI.",
    },
    {
      field: "ltf.chochLtf",
      decision: String(ltfState.chochLtf),
      reason: ltfState.chochLtf ? "A CHoCH was detected on the LTF chart." : "No LTF CHoCH detected.",
    },
    {
      field: "ltf.poiLtfBaru",
      decision: String(ltfState.poiLtfBaru),
      reason: ltfState.poiLtfBaru
        ? "A new LTF OB/FVG formed after the LTF CHoCH."
        : "No new LTF POI formed after the CHoCH.",
    },
    {
      field: "setup.entry",
      decision: String(entry),
      reason: entry ? `Entry placed at the POI zone midpoint for a ${tradeDirection} setup.` : "No entry could be calculated.",
    },
    {
      field: "setup.stopLoss",
      decision: String(stopLoss),
      reason: stopLoss ? `SL placed beyond the recent swing with an ATR buffer.` : "No stop loss could be calculated.",
    },
    {
      field: "setup.takeProfit",
      decision: String(takeProfit),
      reason: takeProfit ? `TP targets the next opposing liquidity or a 1:2.5 RR projection.` : "No take profit could be calculated.",
    },
    {
      field: "setup.invalidations.slBreached",
      decision: String(slBreached),
      reason: slBreached ? "Price already traded through the proposed SL level." : "Price has not traded through the proposed SL.",
    },
    {
      field: "setup.invalidations.structureFailed",
      decision: String(structureFailed),
      reason: structureFailed
        ? "An opposing CHoCH formed on HTF before the entry was reached."
        : "No opposing CHoCH has invalidated the setup yet.",
    },
    {
      field: "order.orderType",
      decision: orderType,
      reason: orderType === "buy" ? "Long direction → buy limit." : "Short direction → sell limit.",
    },
    {
      field: "finalStatus",
      decision: finalStatus.label,
      reason: `Gate=${gateChecks.trendAligned && gateChecks.poiPatience}, Sweep=${sweepStatus}, LTF filters=${checkedCount}/3, RR=${rr ? rr.toFixed(2) : "n/a"}, Invalidated=${invalidated}.`,
    },
  ]

  return {
    gateChecks,
    initial: { modal: "", maxRisk: String(maxRiskPct ?? "") },
    topDown: {
      assetPair: symbol || "",
      htfTimeframe: "4H",
      structureDirection,
      lastSignal,
      ob,
      obPrice,
      fvg,
      fvgPrice,
    },
    liquidity: {
      equalHighs,
      equalLows,
      trendline,
      liquidityPrice: nearestLevel ? roundPrice(nearestLevel.price) : "",
      sweepAnswers: {
        htfCandleRejection: sweep.htfCandleRejection,
        sweepAfterPoi,
      },
    },
    ltf: ltfState,
    setup: {
      entry: String(entry),
      stopLoss: String(stopLoss),
      takeProfit: String(takeProfit),
      invalidations: { slBreached, structureFailed },
    },
    order: { orderType },
    finalStatus,
    explanation,
    rr,
  }
}
