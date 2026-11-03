export default function FinalSummary({
  assetPair,
  entry,
  stopLoss,
  takeProfit,
  gatePassed,
  sweepStatus,
  reaksiHtfPoi,
  chochLtf,
  poiLtfBaru,
  invalidations,
}) {
  const entryNum = parseFloat(entry)
  const slNum = parseFloat(stopLoss)
  const tpNum = parseFloat(takeProfit)

  let tradeType = "—"
  if (entry !== "" && stopLoss !== "" && Number.isFinite(entryNum) && Number.isFinite(slNum)) {
    if (entryNum > slNum) tradeType = "LONG"
    else if (entryNum < slNum) tradeType = "SHORT"
  }

  let rrValue = null
  if (entry !== "" && stopLoss !== "" && takeProfit !== "") {
    const entrySlDistance = Math.abs(entryNum - slNum)
    if (entrySlDistance > 0 && Number.isFinite(entryNum) && Number.isFinite(slNum) && Number.isFinite(tpNum)) {
      const reward = Math.abs(entryNum - tpNum) / entrySlDistance
      if (Number.isFinite(reward)) {
        rrValue = reward
      }
    }
  }

  const rrRatio = rrValue !== null ? `1 : ${rrValue.toFixed(2)}` : "—"

  const checkedCount = [reaksiHtfPoi, chochLtf, poiLtfBaru].filter(Boolean).length
  const invalidated = invalidations.slBreached || invalidations.structureFailed

  let status = {
    label: "WAIT",
    color: "amber",
    icon: "🟡",
  }

  if (!gatePassed || sweepStatus !== "Sudah Disapu" || invalidated) {
    status = {
      label: "CANCEL",
      color: "rose",
      icon: "🔴",
    }
  } else if (rrValue >= 2 && checkedCount >= 2 && chochLtf) {
    status = {
      label: "SET LIMIT ORDER",
      color: "emerald",
      icon: "✅",
    }
  }

  const badgeClasses = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  }

  const rows = [
    { label: "Asset Pair", value: assetPair || "—" },
    { label: "Trade Type", value: tradeType },
    { label: "Entry Price", value: entry !== "" ? entryNum.toLocaleString("id-ID") : "—" },
    { label: "Stop Loss (SL)", value: stopLoss !== "" ? slNum.toLocaleString("id-ID") : "—" },
    { label: "RR Ratio", value: rrRatio },
  ]

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
            Section 6: FINAL
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Ringkasan akhir sebelum mengeksekusi order.
          </p>
        </div>

        <div className="p-6">
          <div className="rounded-xl border border-dashed border-slate-600 bg-slate-950/50 p-6 font-mono text-sm">
            <div className="mb-4 flex items-center justify-between border-b border-slate-700 pb-3">
              <span className="text-xs uppercase tracking-widest text-slate-400">Summary</span>
              <span className="text-xs text-slate-500">SPOT</span>
            </div>

            {rows.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-slate-800 py-2 last:border-b-0"
              >
                <span className="text-slate-400">{label}</span>
                <span className="font-semibold text-slate-100">{value}</span>
              </div>
            ))}

            <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-slate-200">FINAL STATUS</span>
              <span
                className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-bold ${badgeClasses[status.color]}`}
              >
                <span className="mr-2">{status.icon}</span>
                {status.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
