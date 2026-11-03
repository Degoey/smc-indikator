import useIndodaxTicker from "../hooks/useIndodaxTicker"

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

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-"
  }

  return value.toLocaleString("id-ID", { maximumFractionDigits: 8 })
}

export default function LiveMarketData() {
  const { data, loading, error, refresh } = useIndodaxTicker()

  const spread = data ? data.sell - data.buy : null

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
              Live Market Data — BTC/IDR (Indodax)
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Auto-updates every 30 seconds
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
                Error fetching market data: {error}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-400">Last Price</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">
                {loading && !data ? "Loading..." : formatPrice(data?.last)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-400">Bid</p>
              <p className="mt-1 text-lg font-semibold text-emerald-400">
                {loading && !data ? "Loading..." : formatPrice(data?.buy)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-400">Ask</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {loading && !data ? "Loading..." : formatPrice(data?.sell)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-400">24h High</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {loading && !data ? "Loading..." : formatPrice(data?.high)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-400">24h Low</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {loading && !data ? "Loading..." : formatPrice(data?.low)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-400">Spread</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {loading && !data ? "Loading..." : formatPrice(spread)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-400">Volume BTC</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {loading && !data ? "Loading..." : formatNumber(data?.vol_btc)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-400">Volume IDR</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {loading && !data ? "Loading..." : formatPrice(data?.vol_idr)}
              </p>
            </div>
          </div>

          {data?.server_time && (
            <p className="mt-4 text-xs text-slate-500">
              Last updated: {new Date(data.server_time * 1000).toLocaleString("id-ID")}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
