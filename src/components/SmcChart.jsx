import { useEffect, useRef, useState, useMemo } from "react"
import {
  createChart,
  CandlestickSeries,
  LineStyle,
  ColorType,
  CrosshairMode,
  createSeriesMarkers,
} from "lightweight-charts"
import { generateDummyCandles } from "./smc/dummyData"
import { buildLiquidityLevels, detectPivots, deriveStructureBreaks } from "./smc/pivots"
import { OBZonePrimitive } from "./smc/obZonePrimitive"
import { fetchOhlc } from "../lib/indodaxProxy.js"

const COLORS = {
  bullish: "#10b981",
  bearish: "#f43f5e",
  bullTransparent: "rgba(16,185,129,0.6)",
  bearTransparent: "rgba(244,63,94,0.6)",
  liquidity: "rgba(250,204,21,0.7)",
}

function buildMarkers(pivots) {
  if (!pivots) return []

  const markerList = []

  pivots.highs.forEach((p) => {
    markerList.push({
      time: p.time,
      position: "aboveBar",
      color: COLORS.bearish,
      shape: "arrowDown",
      text: p.label,
    })
  })

  pivots.lows.forEach((p) => {
    markerList.push({
      time: p.time,
      position: "belowBar",
      color: COLORS.bullish,
      shape: "arrowUp",
      text: p.label,
    })
  })

  return markerList
}

function drawStructureBreaks(series, structure, priceLines) {
  if (!structure) return

  structure.events.forEach((event) => {
    const isBullish = event.direction === "bullish"
    const line = series.createPriceLine({
      price: event.price,
      color: isBullish ? COLORS.bullTransparent : COLORS.bearTransparent,
      lineWidth: 1,
      lineStyle: event.type === "CHoCH" ? LineStyle.Dashed : LineStyle.Solid,
      axisLabelVisible: true,
      title: `${event.type} ${isBullish ? "(Bull)" : "(Bear)"}`,
    })
    priceLines.push(line)
  })
}

function drawLiquidityLevels(series, levels, priceLines) {
  levels.forEach((level) => {
    const line = series.createPriceLine({
      price: level.price,
      color: COLORS.liquidity,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: level.label,
    })
    priceLines.push(line)
  })
}

function deriveOrderBlockZones(candles, pivots) {
  if (!pivots || pivots.lows.length < 2 || pivots.highs.length < 2 || candles.length < 5) {
    return []
  }

  const zones = []
  const lastTime = candles[candles.length - 1].time
  const recentLows = pivots.lows.slice(-2)
  const recentHighs = pivots.highs.slice(-2)

  const demand = recentLows[recentLows.length - 1]
  const demandCandle = candles[demand.index]
  zones.push({
    type: "demand",
    startTime: demand.time,
    endTime: lastTime,
    topPrice: demandCandle.close,
    bottomPrice: demandCandle.low,
    fillColor: "rgba(16,185,129,0.12)",
    borderColor: "rgba(16,185,129,0.45)",
    label: "Demand OB",
  })

  const supply = recentHighs[recentHighs.length - 1]
  const supplyCandle = candles[supply.index]
  zones.push({
    type: "supply",
    startTime: supply.time,
    endTime: lastTime,
    topPrice: supplyCandle.high,
    bottomPrice: supplyCandle.close,
    fillColor: "rgba(244,63,94,0.12)",
    borderColor: "rgba(244,63,94,0.45)",
    label: "Supply OB",
  })

  return zones
}

function computeDataFromCandles(candles) {
  const pivots = detectPivots(candles)
  const structure = deriveStructureBreaks(pivots.highs, pivots.lows)
  const liquidity = buildLiquidityLevels(candles, 4)
  const obZones = deriveOrderBlockZones(candles, pivots)

  return {
    candles,
    pivots,
    structure,
    liquidity,
    obZones,
  }
}


function computeInitialData() {
  return computeDataFromCandles(generateDummyCandles(100))
}

export default function SmcChart({ symbol }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const markersApiRef = useRef(null)
  const priceLinesRef = useRef([])
  const obPrimitiveRef = useRef(null)
  const resizeObserverRef = useRef(null)
  const rafRef = useRef(null)

  const [dataState, setDataState] = useState(computeInitialData)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadLive() {
      if (!symbol) {
        setDataState(computeInitialData())
        setIsLive(false)
        return
      }

      try {
        const candles = await fetchOhlc({ symbol, timeframe: "240" })
        if (cancelled) return

        if (Array.isArray(candles) && candles.length >= 30) {
          setDataState(computeDataFromCandles(candles))
          setIsLive(true)
        } else {
          setDataState(computeInitialData())
          setIsLive(false)
        }
      } catch {
        if (!cancelled) {
          setDataState(computeInitialData())
          setIsLive(false)
        }
      }
    }

    loadLive()
    return () => {
      cancelled = true
    }
  }, [symbol])

  const dashboard = useMemo(() => {
    const { candles, structure } = dataState
    if (!candles.length || !structure) {
      return { trendPositive: false, upper: 0, lower: 0, mid: 0 }
    }

    const latestClose = candles[candles.length - 1].close

    const upper = structure.lastHigh ? structure.lastHigh.price : candles[candles.length - 1].high
    const lower = structure.lastLow ? structure.lastLow.price : candles[candles.length - 1].low
    const mid = (upper + lower) / 2

    const trendPositive = latestClose >= mid

    return { trendPositive, upper, lower, mid }
  }, [dataState])

  useEffect(() => {
    if (!containerRef.current || dataState.candles.length === 0) return

    const { width, height } = containerRef.current.getBoundingClientRect()

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0f19" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: {
        borderColor: "#1f2937",
      },
      timeScale: {
        borderColor: "#1f2937",
        timeVisible: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      width,
      height,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.bullish,
      downColor: COLORS.bearish,
      wickUpColor: COLORS.bullish,
      wickDownColor: COLORS.bearish,
      borderVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series

    series.setData(dataState.candles)

    const markers = buildMarkers(dataState.pivots)
    const markersApi = createSeriesMarkers(series, markers)
    markersApiRef.current = markersApi

    drawStructureBreaks(series, dataState.structure, priceLinesRef.current)
    drawLiquidityLevels(series, dataState.liquidity, priceLinesRef.current)

    const primitive = new OBZonePrimitive(dataState.obZones)
    obPrimitiveRef.current = primitive
    series.attachPrimitive(primitive)

    chart.timeScale().fitContent()

    const resizeHandler = (entries) => {
      if (!chartRef.current) return
      const entry = entries[0]
      if (!entry) return
      const newWidth = entry.contentRect.width
      const newHeight = entry.contentRect.height
      window.cancelAnimationFrame?.call(window, rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        chartRef.current?.applyOptions({ width: newWidth })
        chartRef.current?.resize(newWidth, newHeight)
      })
    }

    const obs = new ResizeObserver(resizeHandler)
    obs.observe(containerRef.current)
    resizeObserverRef.current = obs

    const handleWindowResize = () => {
      if (!containerRef.current || !chartRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      chartRef.current.applyOptions({ width: rect.width })
      chartRef.current.resize(rect.width, rect.height)
    }

    window.addEventListener("resize", handleWindowResize)

    return () => {
      window.removeEventListener("resize", handleWindowResize)
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      priceLinesRef.current.forEach((line) => {
        try {
          seriesRef.current?.removePriceLine(line)
        } catch {
          // ignore cleanup errors
        }
      })
      priceLinesRef.current = []

      try {
        if (obPrimitiveRef.current) {
          seriesRef.current?.detachPrimitive(obPrimitiveRef.current)
          obPrimitiveRef.current = null
        }
      } catch {
        // ignore
      }

      try {
        chartRef.current?.remove()
      } catch {
        // ignore
      }
      chartRef.current = null
      seriesRef.current = null
      markersApiRef.current = null
    }
  }, [dataState])

  const legendItems = [
    { label: "HH", color: "bg-rose-500" },
    { label: "LH", color: "bg-rose-500/70" },
    { label: "HL", color: "bg-emerald-500" },
    { label: "LL", color: "bg-emerald-500/70" },
    { label: "BOS", color: "bg-emerald-400/80" },
    { label: "CHoCH", color: "bg-rose-400/80" },
    { label: "Supply OB", color: "bg-rose-500/50" },
    { label: "Demand OB", color: "bg-emerald-500/50" },
    { label: "Liquidity", color: "bg-amber-300" },
  ]

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
            SMC Chart - Interactive Overlay {isLive ? `(Live: ${symbol})` : "(Demo)"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {isLive
              ? `Live OHLC candlestick chart (4H) untuk ${symbol} dari Indodax dengan overlays SMC.`
              : "Demo OHLC candlestick chart dengan overlays Smart Money Concepts (SMC):"}
            pivot structure, BOS/CHoCH, order block zones, dan liquidity levels.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {legendItems.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/50 px-2 py-1 text-[10px] font-medium text-slate-300"
              >
                <span className={`h-2 w-2 rounded-full ${item.color}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative p-4">
          <div ref={containerRef} className="relative h-[520px] w-full rounded-xl overflow-hidden">
            {dataState.candles.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                Loading chart data...
              </div>
            )}
          </div>

          <div className="absolute bottom-4 right-4 z-10 min-w-[220px] rounded-xl border border-slate-700 bg-slate-900/90 p-4 shadow-xl backdrop-blur font-mono text-xs">
            <div className="mb-3 text-slate-400 uppercase tracking-widest">SMC Overlay Dashboard</div>

            <div className="mb-3">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  dashboard.trendPositive
                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                    : "border-rose-500/30 bg-rose-500/15 text-rose-400"
                }`}
              >
                Trend: {dashboard.trendPositive ? "Positive" : "Negative"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Upper Range</span>
                <span className="text-slate-200">
                  {dashboard.upper.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lower Range</span>
                <span className="text-slate-200">
                  {dashboard.lower.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2">
                <span className="text-slate-500">Mid-point</span>
                <span className="text-slate-200">
                  {dashboard.mid.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
