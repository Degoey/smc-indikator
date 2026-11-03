import { useState } from "react"

const ENTRY_FILTERS = [
  {
    id: "reaksiHtfPoi",
    label: "Reaksi HTF POI",
    subtext: "Harga bereaksi valid di zona OB/FVG Timeframe Besar, tidak tembus bablas.",
  },
  {
    id: "chochLtf",
    label: "CHoCH LTF",
    subtext: "Struktur patah di LTF, menandakan institusi masuk.",
  },
  {
    id: "poiLtfBaru",
    label: "POI LTF Baru",
    subtext: "Mencetak OB/FVG baru setelah CHoCH terbentuk.",
  },
]

export default function KonfirmasiLTF({ filters, setFilters }) {
  const [timeframe, setTimeframe] = useState("")

  const handleFilterChange = (id) => (event) => {
    setFilters((prev) => ({ ...prev, [id]: event.target.checked }))
  }

  let alert = null
  if (!filters.chochLtf) {
    alert = (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <p className="text-sm font-semibold text-amber-400">TUNDA: Harga masih bisa tembus POI HTF</p>
      </div>
    )
  } else if (!filters.poiLtfBaru) {
    alert = (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
        <p className="text-sm font-semibold text-red-400">TUNDA/CANCEL: Pergerakan tidak mulus, tidak ada area entry yang jelas</p>
      </div>
    )
  } else {
    alert = (
      <p className="text-sm font-semibold text-emerald-400">Filter entry lolos</p>
    )
  }

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
            Section 3: KONFIRMASI TIMEFRAME KECIL (LTF)
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Konfirmasi setup entry pada timeframe kecil setelah kondisi HTF terpenuhi.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="ltfTimeframe" className="block text-sm font-medium text-slate-300 mb-2">
                Timeframe LTF
              </label>
              <input
                id="ltfTimeframe"
                type="text"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                placeholder="e.g. 15m, 5m, 1m"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <span className="block text-sm font-semibold text-slate-200 mb-3">FILTER ENTRY</span>
              <div className="space-y-3">
                {ENTRY_FILTERS.map(({ id, label, subtext }) => (
                  <label
                    key={id}
                    htmlFor={id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 transition hover:border-slate-600"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={filters[id]}
                      onChange={handleFilterChange(id)}
                      className="mt-0.5 h-5 w-5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                    />
                    <div>
                      <span className="block text-sm font-medium text-slate-200">{label}</span>
                      <span className="block text-sm text-slate-400">{subtext}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {alert}
          </div>
        </div>
      </div>
    </section>
  )
}
