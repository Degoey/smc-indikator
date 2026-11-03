import { useCallback, useEffect, useState } from "react"

const PROXY_BASE = import.meta.env?.VITE_INDODAX_PROXY_URL || "http://localhost:8787/proxy/indodax"
const REFRESH_INTERVAL = 30_000

function mapTicker(data) {
  if (!data || !data.ticker) {
    return null
  }

  const ticker = data.ticker

  return {
    last: Number(ticker.last),
    buy: Number(ticker.buy),
    sell: Number(ticker.sell),
    high: Number(ticker.high),
    low: Number(ticker.low),
    vol_btc: Number(ticker.vol_btc),
    vol_idr: Number(ticker.vol_idr),
    server_time: Number(ticker.server_time),
  }
}

export default function useIndodaxTicker() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading((prev) => prev || true)
    setError(null)

    try {
      const response = await fetch(`${PROXY_BASE}/ticker/btc_idr`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const payload = await response.json()
      const mapped = mapTicker(payload)

      if (!mapped) {
        throw new Error("Invalid response format from Indodax API")
      }

      setData(mapped)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch market data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${PROXY_BASE}/ticker/btc_idr`)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const payload = await response.json()
        const mapped = mapTicker(payload)

        if (!mapped) {
          throw new Error("Invalid response format from Indodax API")
        }

        if (!isCancelled) {
          setData(mapped)
          setError(null)
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch market data")
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()
    const intervalId = setInterval(fetchData, REFRESH_INTERVAL)

    return () => {
      isCancelled = true
      clearInterval(intervalId)
    }
  }, [])

  return { data, loading, error, refresh }
}
