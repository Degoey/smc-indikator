import { useCallback, useRef, useState } from "react"
import { fetchOhlc } from "../lib/indodaxProxy.js"
import { analyzeSMC } from "../lib/smcAutoAnalyzer.js"

const DEFAULT_HTF = "240"
const DEFAULT_LTF = "15"

function normalizeSymbol(symbol) {
  return String(symbol).replace(/_/g, "").toUpperCase()
}

export default function useAutoAnalyze({ maxRiskPct = 2 } = {}) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestIdRef = useRef(0)

  const analyze = useCallback(
    async (pair) => {
      if (!pair) {
        setError("Pilih pair terlebih dahulu.")
        return null
      }

      const symbol = normalizeSymbol(pair)
      const currentId = requestIdRef.current + 1
      requestIdRef.current = currentId

      setLoading(true)
      setError(null)
      setResult(null)

      try {
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => abortController.abort(), 30_000)

        const [htfCandles, ltfCandles] = await Promise.all([
          fetchOhlc({ symbol, timeframe: DEFAULT_HTF }),
          fetchOhlc({ symbol, timeframe: DEFAULT_LTF }),
        ])

        clearTimeout(timeoutId)

        const analysis = analyzeSMC({
          htfCandles,
          ltfCandles,
          symbol: pair,
          maxRiskPct,
        })

        if (currentId === requestIdRef.current) {
          setResult(analysis)
          setLoading(false)
        }

        return analysis
      } catch (err) {
        if (err.name === "AbortError") {
          setError("Permintaan analisis timeout.")
        } else {
          setError(err instanceof Error ? err.message : "Analisis gagal")
        }
        setLoading(false)
        return null
      }
    },
    [maxRiskPct]
  )

  return { analyze, result, loading, error }
}
