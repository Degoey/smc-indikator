import { useCallback, useEffect, useState } from "react"

const PROXY_BASE = import.meta.env?.VITE_INDODAX_PROXY_URL || "http://localhost:8787/proxy/indodax"
const REFRESH_INTERVAL = 60_000

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return Number.NaN
  }

  const n = Number(value)
  return Number.isNaN(n) ? Number.NaN : n
}

function getVolumeIdr(ticker, tradedCurrency) {
  const direct = toNumber(ticker?.vol_idr)

  if (!Number.isNaN(direct) && direct > 0) {
    return direct
  }

  if (tradedCurrency) {
    const volCoin = toNumber(ticker?.[`vol_${tradedCurrency.toLowerCase()}`])
    const last = toNumber(ticker?.last)

    if (!Number.isNaN(volCoin) && !Number.isNaN(last)) {
      return volCoin * last
    }
  }

  return Number.NaN
}

function formatDisplayName(pair) {
  if (pair.description) {
    return pair.description
  }

  const base = pair.traded_currency_unit || pair.traded_currency?.toUpperCase() || ""
  const quote = pair.base_currency?.toUpperCase() || "IDR"

  return `${base}/${quote}`
}

export default function useIndodaxTopCoins() {
  const [coins, setCoins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [pairsResponse, summariesResponse] = await Promise.all([
        fetch(`${PROXY_BASE}/pairs`),
        fetch(`${PROXY_BASE}/summaries`),
      ])

      if (!pairsResponse.ok) {
        throw new Error(`Pairs API error! status: ${pairsResponse.status}`)
      }

      if (!summariesResponse.ok) {
        throw new Error(`Summaries API error! status: ${summariesResponse.status}`)
      }

      const pairsPayload = await pairsResponse.json()
      const summariesPayload = await summariesResponse.json()

      const tickers = summariesPayload?.tickers ?? {}
      const pairs = Array.isArray(pairsPayload) ? pairsPayload : []

      const processed = []

      for (const pair of pairs) {
        if (!pair?.ticker_id) {
          continue
        }

        const ticker = tickers[pair.ticker_id]

        if (!ticker) {
          continue
        }

        const volume24hIdr = getVolumeIdr(ticker, pair.traded_currency)

        if (Number.isNaN(volume24hIdr) || volume24hIdr <= 0) {
          continue
        }

        const lastPrice = toNumber(ticker.last)

        processed.push({
          rank: 0,
          pair: pair.ticker_id,
          symbol: pair.symbol ?? pair.ticker_id.toUpperCase(),
          displayName: formatDisplayName(pair),
          lastPrice,
          volume24hIdr,
        })
      }

      const top50 = processed
        .sort((a, b) => b.volume24hIdr - a.volume24hIdr)
        .slice(0, 50)
        .map((coin, index) => ({ ...coin, rank: index + 1 }))

      setCoins(top50)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch top coins")
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    fetchData()

    const intervalId = setInterval(fetchData, REFRESH_INTERVAL)

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchData])

  return { coins, loading, error, refresh }
}
