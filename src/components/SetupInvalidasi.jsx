import { useMemo } from "react"

export default function SetupInvalidasi({
  entry,
  setEntry,
  stopLoss,
  setStopLoss,
  takeProfit,
  setTakeProfit,
  invalidations,
  setInvalidations,
}) {
  const handleInvalidationChange = (id) => (event) => {
    setInvalidations((prev) => ({ ...prev, [id]: event.target.checked }))
  }

  const isCancelled = invalidations.slBreached || invalidations.structureFailed

  const entryNum = parseFloat(entry)
  const slNum = parseFloat(stopLoss)
  const tpNum = parseFloat(takeProfit)

  const slPercentage = useMemo(() => {
    if (!entry || entryNum === 0) {
      return "—"
    }
    const value = ((entryNum - slNum) / entryNum) * 100
    if (!Number.isFinite(value)) {
      return "—"
    }
    return `${value.toFixed(2)}%`
  }, [entryNum, slNum, entry])

  const { rrRatio, rrColor, rrWarning } = useMemo(() => {
    if (!entry || !stopLoss || !takeProfit) {
      return { rrRatio: "—", rrColor: "text-slate-100", rrWarning: "" }
    }
    const entrySlDistance = Math.abs(entryNum - slNum)
    if (entrySlDistance === 0 || entryNum === 0) {
      return { rrRatio: "—", rrColor: "text-slate-100", rrWarning: "" }
    }
    const reward = Math.abs(entryNum - tpNum) / entrySlDistance
    if (!Number.isFinite(reward)) {
      return { rrRatio: "—", rrColor: "text-slate-100", rrWarning: "" }
    }
    const ratio = `1 : ${reward.toFixed(2)}`
    if (reward < 2) {
      return {
        rrRatio: ratio,
        rrColor: "text-red-400",
        rrWarning: "Peringatan: RR kurang dari standar minimal 1:2",
      }
    }
    return { rrRatio: ratio, rrColor: "text-emerald-400", rrWarning: "" }
  }, [entryNum, slNum, tpNum, entry, stopLoss, takeProfit])

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
            Section 4: SETUP &amp; INVALIDASI
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Catatan harga entry, stop loss, take profit, dan kriteria pembatalan setup.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label htmlFor="entryPrice" className="block text-sm font-medium text-slate-300">
              Harga Entry (Rp)
            </label>
            <input
              id="entryPrice"
              type="number"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="e.g. 150000000"
              className="w-full rounded-lg border-2 border-slate-700 bg-slate-950 px-4 py-3 text-lg font-semibold text-emerald-400 placeholder-slate-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="stopLoss" className="block text-sm font-medium text-slate-300">
              Stop Loss / SL (Rp)
            </label>
            <input
              id="stopLoss"
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="e.g. 148000000"
              className="w-full rounded-lg border-2 border-slate-700 bg-slate-950 px-4 py-3 text-lg font-semibold text-red-400 placeholder-slate-600 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/50"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="takeProfit" className="block text-sm font-medium text-slate-300">
              Take Profit / TP (Rp)
            </label>
            <input
              id="takeProfit"
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="e.g. 160000000"
              className="w-full rounded-lg border-2 border-slate-700 bg-slate-950 px-4 py-3 text-lg font-semibold text-emerald-400 placeholder-slate-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-sm font-medium text-slate-400">Stop Loss (SL) Percentage</p>
            <p className="mt-1 text-2xl font-bold text-slate-100">{slPercentage}</p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-sm font-medium text-slate-400">Risk to Reward (RR) Ratio</p>
            <p className={`mt-1 text-2xl font-bold ${rrColor}`}>{rrRatio}</p>
            {rrWarning && (
              <p className="mt-2 text-sm font-semibold text-red-400">{rrWarning}</p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-700 px-6 py-5 bg-slate-800/30">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">INVALIDASI (Batal Jika)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label
              htmlFor="slBreached"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 transition hover:border-slate-600"
            >
              <input
                id="slBreached"
                type="checkbox"
                checked={invalidations.slBreached}
                onChange={handleInvalidationChange("slBreached")}
                className="mt-0.5 h-5 w-5 rounded border-slate-600 bg-slate-950 text-red-500 focus:ring-red-500 focus:ring-offset-slate-900"
              />
              <span className="block text-sm text-slate-300">
                Harga menembus area SL sebelum menjemput area Entry Limit.
              </span>
            </label>

            <label
              htmlFor="structureFailed"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 transition hover:border-slate-600"
            >
              <input
                id="structureFailed"
                type="checkbox"
                checked={invalidations.structureFailed}
                onChange={handleInvalidationChange("structureFailed")}
                className="mt-0.5 h-5 w-5 rounded border-slate-600 bg-slate-950 text-red-500 focus:ring-red-500 focus:ring-offset-slate-900"
              />
              <span className="block text-sm text-slate-300">
                Struktur gagal: Bikin CHoCH ke arah berlawanan sebelum harga menjemput Limit Order.
              </span>
            </label>
          </div>

          {isCancelled && (
            <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-center text-sm font-bold text-red-400 uppercase tracking-wide">
                TRADING SETUP BATAL
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
