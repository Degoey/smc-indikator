import useIndodaxTopCoins from "../hooks/useIndodaxTopCoins"

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-"
  }

  return value.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
}

function formatVolume(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-"
  }

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })}B`
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })}M`
  }

  return value.toLocaleString("id-ID", { maximumFractionDigits: 0 })
}

export default function CoinSelector({ selectedSymbol, onSelect }) {
  const { coins, loading, error, refresh } = useIndodaxTopCoins()

  const isEmpty = coins.length === 0

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
              Top 50 Most Active Pairs
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Ranked by 24h volume on Indodax. Auto-refreshes every 60 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Refresh
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="rounded-lg border border-pink-500/30 bg-pink-500/10 px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-pink-400">
                Error fetching top coins: {error}
              </p>
            </div>
          )}

          {loading && isEmpty && (
            <p className="text-sm text-slate-400">Loading top pairs...</p>
          )}

          {!loading && isEmpty && !error && (
            <p className="text-sm text-slate-400">No active pairs found.</p>
          )}

          {(!isEmpty || !loading) && (
            <div className="space-y-2">
              <label htmlFor="coinSelector" className="block text-sm font-medium text-slate-300">
                Select Asset Pair
              </label>
              <select
                id="coinSelector"
                value={selectedSymbol ?? ""}
                onChange={(e) => onSelect?.(e.target.value)}
                disabled={loading && isEmpty}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">-- Choose a pair --</option>
                {coins.map((coin) => (
                  <option key={coin.pair} value={coin.symbol}>
                    #{coin.rank} {coin.symbol} — {formatPrice(coin.lastPrice)} — Vol {formatVolume(coin.volume24hIdr)} IDR
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedSymbol && (
            <p className="mt-4 text-sm text-emerald-400">
              Selected pair: {selectedSymbol}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
