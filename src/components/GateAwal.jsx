const CHECKBOXES = [
  {
    id: "trendAligned",
    label: "Arah Tren HTF: Tidak melawan tren Timeframe Besar",
  },
  {
    id: "poiPatience",
    label: "Kesabaran POI: Harga SUDAH masuk ke area POI HTF",
  },
]

export default function GateAwal({ gateChecks = {}, setGateChecks }) {
  const handleChange = (id) => (event) => {
    const next = { ...gateChecks, [id]: event.target.checked }
    setGateChecks(next)
  }

  const isValid = Object.values(gateChecks).every(Boolean)

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
            GATE AWAL (WAJIB LOLOS)
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Centang kedua persyaratan di bawah sebelum melanjutkan ke Timeframe Kecil (LTF).
          </p>
        </div>

        <div className="p-6 space-y-4">
          {CHECKBOXES.map(({ id, label }) => (
            <label
              key={id}
              htmlFor={id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-700"
            >
              <input
                id={id}
                type="checkbox"
                checked={Boolean(gateChecks[id])}
                onChange={handleChange(id)}
                className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <span className="text-sm font-medium text-slate-200">{label}</span>
            </label>
          ))}

          {!isValid && (
            <div className="rounded-lg border border-pink-500/30 bg-pink-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-pink-400">
                CANCEL/TUNDA: Dilarang turun ke Timeframe Kecil (LTF)
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
