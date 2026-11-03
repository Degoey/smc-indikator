const TARGET_OPTIONS = [
  { id: "equalHighs", label: "Equal Highs" },
  { id: "equalLows", label: "Equal Lows" },
  { id: "trendline", label: "Trendline" },
]

const SWEEP_QUESTIONS = [
  {
    id: "htfCandleRejection",
    label: "Candle HTF menyentuh area likuiditas lalu menolak keras (sumbu panjang)?",
  },
  {
    id: "sweepAfterPoi",
    label: "Harga menyapu likuiditas SETELAH masuk area POI HTF?",
  },
]

export default function PenyapuanLikuiditas({ liquidity = {}, setLiquidity }) {
  const targets = liquidity || {}
  const answers = liquidity?.sweepAnswers || { htfCandleRejection: "", sweepAfterPoi: "" }

  const handleTargetChange = (id) => (event) => {
    setLiquidity((prev) => ({ ...prev, [id]: event.target.checked }))
  }

  const handleAnswerChange = (id) => (event) => {
    setLiquidity((prev) => ({ ...prev, sweepAnswers: { ...prev.sweepAnswers, [id]: event.target.value } }))
  }

  const handlePriceChange = (event) => {
    setLiquidity((prev) => ({ ...prev, liquidityPrice: event.target.value }))
  }

  const answeredAll = SWEEP_QUESTIONS.every(({ id }) => answers[id] !== "")
  const allYes = SWEEP_QUESTIONS.every(({ id }) => answers[id] === "ya")
  const anyNo = SWEEP_QUESTIONS.some(({ id }) => answers[id] === "tidak")

  let statusBadge = null
  if (!answeredAll) {
    statusBadge = (
      <span className="inline-flex items-center rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-400">
        —
      </span>
    )
  } else if (allYes) {
    statusBadge = (
      <span className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-400">
        Sudah Disapu (LANJUT LTF)
      </span>
    )
  } else if (anyNo) {
    statusBadge = (
      <span className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-400">
        Belum Tersapu (WAIT)
      </span>
    )
  }

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
            Section 2: PENYAPUAN LIKUIDITAS
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Identifikasi target ritel dan konfirmasi penyapuan likuiditas sebelum turun ke LTF.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <span className="block text-sm font-medium text-slate-300 mb-3">Target Ritel</span>
              <div className="space-y-3">
                {TARGET_OPTIONS.map(({ id, label }) => (
                  <label
                    key={id}
                    htmlFor={id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 transition hover:border-slate-600"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={Boolean(targets[id])}
                      onChange={handleTargetChange(id)}
                      className="h-5 w-5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-sm font-medium text-slate-200">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="liquidityPrice" className="block text-sm font-medium text-slate-300 mb-2">
                Harga Likuiditas (Rp)
              </label>
              <input
                id="liquidityPrice"
                type="number"
                value={targets.liquidityPrice || ""}
                onChange={handlePriceChange}
                placeholder="e.g. 150000000"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <span className="block text-sm font-medium text-slate-300 mb-3">Syarat Sweep (Objektif)</span>
              <div className="space-y-5">
                {SWEEP_QUESTIONS.map(({ id, label }) => (
                  <div key={id} className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-sm font-medium text-slate-200 mb-3">{label}</p>
                    <div className="flex flex-wrap gap-4">
                      {["ya", "tidak"].map((value) => (
                        <label
                          key={value}
                          htmlFor={`${id}-${value}`}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 transition hover:border-slate-600"
                        >
                          <input
                            id={`${id}-${value}`}
                            type="radio"
                            name={id}
                            value={value}
                            checked={answers[id] === value}
                            onChange={handleAnswerChange(id)}
                            className="h-4 w-4 border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                          />
                          <span className="text-sm text-slate-200 capitalize">
                            {value === "ya" ? "Ya" : "Tidak"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
              <span className="text-sm font-semibold text-slate-200">Status Sweep</span>
              {statusBadge}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
