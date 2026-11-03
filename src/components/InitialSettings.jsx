const MARKET = "SPOT"

const formatIdr = (value) => {
  if (!value && value !== 0) return ""
  const number = Number(value)
  if (Number.isNaN(number)) return ""
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number)
}

export default function InitialSettings({ modal, setModal, maxRisk, setMaxRisk }) {
  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
            SMC Trading Checklist
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Configure your session parameters before entering the SPOT market.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <label htmlFor="modal" className="block text-sm font-medium text-slate-300 mb-2">
              Modal (IDR)
            </label>
            <input
              id="modal"
              type="number"
              value={modal}
              onChange={(e) => setModal(e.target.value)}
              placeholder="e.g. 10000000"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <p className="mt-2 text-xs font-mono text-emerald-400 min-h-[1rem]">
              {modal ? formatIdr(modal) : ""}
            </p>
          </div>

          <div className="md:col-span-1">
            <label htmlFor="maxRisk" className="block text-sm font-medium text-slate-300 mb-2">
              Maximum Risk (%)
            </label>
            <input
              id="maxRisk"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={maxRisk}
              onChange={(e) => setMaxRisk(e.target.value)}
              placeholder="e.g. 2"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <p className="mt-2 text-xs text-slate-500 min-h-[1rem]">
              {maxRisk ? `Risking ${maxRisk}% of modal per trade.` : ""}
            </p>
          </div>

          <div className="md:col-span-1">
            <span className="block text-sm font-medium text-slate-300 mb-2">Market</span>
            <span className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400">
              {MARKET} Market
            </span>
            <p className="mt-2 text-xs text-slate-500">
              This checklist is scoped to SPOT trading only.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-700 px-6 py-4 bg-slate-800/40 rounded-b-2xl">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
            <p className="text-sm font-medium text-slate-200 leading-relaxed">
              Tujuan: SMC Entry (HTF POI + Liquidity Sweep + LTF CHoCH)
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}