import { useState } from "react"
import useAutoAnalyze from "../hooks/useAutoAnalyze"

const STATUS_CLASSES = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-400",
}

function normalizePairInput(value) {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export default function AutoAnalyzePanel({
  initial,
  setInitial,
  topDown,
  setTopDown,
  setGateChecks,
  setLiquidity,
  setLtf,
  setSetup,
  setOrder,
}) {
  const [pair, setPair] = useState(topDown?.assetPair || "")
  const [reasonsOpen, setReasonsOpen] = useState(false)
  const { analyze, result, loading, error } = useAutoAnalyze({ maxRiskPct: initial?.maxRisk || 2 })

  const handleAnalyze = async () => {
    const analysis = await analyze(pair || topDown?.assetPair)
    if (!analysis) return

    if (setInitial) setInitial((prev) => ({ ...prev, ...analysis.initial }))
    if (setGateChecks) setGateChecks(analysis.gateChecks)
    if (setTopDown) setTopDown((prev) => ({ ...prev, ...analysis.topDown, assetPair: pair || prev?.assetPair || "" }))
    if (setLiquidity) setLiquidity(analysis.liquidity)
    if (setLtf) setLtf(analysis.ltf)
    if (setSetup) setSetup(analysis.setup)
    if (setOrder) setOrder(analysis.order)
  }

  const finalStatus = result?.finalStatus || { label: "—", color: "amber" }

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">Analisa SMC Otomatis</h2>
          <p className="mt-1 text-sm text-slate-400">
            Isi Sections 0–6 secara otomatis dari data OHLC live Indodax berdasarkan heuristik SMC.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="autoAnalyzePair" className="block text-sm font-medium text-slate-300 mb-2">
                Simbol Pair (e.g. BTCIDR)
              </label>
              <input
                id="autoAnalyzePair"
                type="text"
                value={pair}
                onChange={(e) => setPair(normalizePairInput(e.target.value))}
                placeholder="BTCIDR"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading || !pair}
                className="w-full rounded-lg bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? "Menganalisa..." : "Analisa Otomatis"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-rose-400">Error: {error}</p>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">FINAL STATUS</p>
                  <span
                    className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-bold mt-1 ${STATUS_CLASSES[finalStatus.color]}`}
                  >
                    <span className="mr-2">{finalStatus.icon}</span>
                    {finalStatus.label}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Trend / Signal</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {result.topDown.structureDirection} / {result.topDown.lastSignal}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">POI OB</p>
                  <p className="font-semibold text-slate-200">
                    {result.topDown.ob ? `Rp ${Number(result.topDown.obPrice).toLocaleString("id-ID")}` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">POI FVG</p>
                  <p className="font-semibold text-slate-200">
                    {result.topDown.fvg ? `Rp ${Number(result.topDown.fvgPrice).toLocaleString("id-ID")}` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">Likuiditas</p>
                  <p className="font-semibold text-slate-200">
                    {result.liquidity.liquidityPrice ? `Rp ${Number(result.liquidity.liquidityPrice).toLocaleString("id-ID")}` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">Entry</p>
                  <p className="font-semibold text-slate-200">
                    {result.setup.entry ? `Rp ${Number(result.setup.entry).toLocaleString("id-ID")}` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">SL / TP</p>
                  <p className="font-semibold text-slate-200">
                    {result.setup.stopLoss ? `Rp ${Number(result.setup.stopLoss).toLocaleString("id-ID")}` : "—"} /{" "}
                    {result.setup.takeProfit ? `Rp ${Number(result.setup.takeProfit).toLocaleString("id-ID")}` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">RR</p>
                  <p className="font-semibold text-slate-200">{result.rr ? `1 : ${result.rr.toFixed(2)}` : "—"}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReasonsOpen((prev) => !prev)}
                className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
              >
                {reasonsOpen ? "Sembunyikan" : "Tampilkan"} Alasan / Reasoning
              </button>

              {reasonsOpen && (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 space-y-2">
                  {result.explanation.map((item) => (
                    <div key={item.field} className="text-sm">
                      <span className="font-semibold text-emerald-400">{item.field}</span>
                      <span className="text-slate-300"> → </span>
                      <span className="font-medium text-slate-200">{item.decision}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-xs text-amber-400">
                  Disclaimer: Ini adalah analisis heuristik otomatis, bukan saran keuangan. Tidak ada order yang
                  ditempatkan. Selalu verifikasi secara manual sebelum trading.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
