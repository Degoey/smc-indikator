const TIMEFRAMES = [
  { value: "", label: "Pilih Timeframe" },
  { value: "MN", label: "Monthly" },
  { value: "W", label: "Weekly" },
  { value: "D", label: "Daily" },
  { value: "4H", label: "4H" },
  { value: "1H", label: "1H" },
  { value: "30M", label: "30M" },
  { value: "15M", label: "15M" },
]

const STRUCTURE_OPTIONS = [
  { value: "Bullish", label: "Bullish" },
  { value: "Bearish", label: "Bearish" },
]

const SIGNAL_OPTIONS = [
  { value: "BOS", label: "BOS" },
  { value: "CHoCH", label: "CHoCH" },
]

export default function TopDownAnalysis({ topDown = {}, setTopDown }) {
  const handleChange = (field) => (event) => {
    const value = event.target.value
    setTopDown((prev) => ({ ...prev, [field]: value }))
  }

  const handleCheckbox = (field) => (event) => {
    setTopDown((prev) => ({ ...prev, [field]: event.target.checked }))
  }

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
            Section 1: TOP-DOWN ANALYSIS (HTF)
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Identifikasi struktur, timeframe, dan area Point of Interest di Higher Timeframe.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="assetPair" className="block text-sm font-medium text-slate-300 mb-2">
                Asset Pair
              </label>
              <input
                id="assetPair"
                type="text"
                value={topDown.assetPair || ""}
                onChange={handleChange("assetPair")}
                placeholder="e.g. BTCUSDT, ETHUSDT"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="htfTimeframe" className="block text-sm font-medium text-slate-300 mb-2">
                HTF Timeframe
              </label>
              <select
                id="htfTimeframe"
                value={topDown.htfTimeframe || ""}
                onChange={handleChange("htfTimeframe")}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf.value} value={tf.value}>
                    {tf.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <span className="block text-sm font-medium text-slate-300 mb-2">Structure Direction</span>
              <div className="flex flex-wrap gap-4">
                {STRUCTURE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={"structure-" + option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2.5 transition hover:border-slate-600"
                  >
                    <input
                      id={"structure-" + option.value}
                      type="radio"
                      name="structure"
                      value={option.value}
                      checked={topDown.structureDirection === option.value}
                      onChange={handleChange("structureDirection")}
                      className="h-4 w-4 border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-sm text-slate-200">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-300 mb-2">Last Signal</span>
              <div className="flex flex-wrap gap-4">
                {SIGNAL_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={"signal-" + option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2.5 transition hover:border-slate-600"
                  >
                    <input
                      id={"signal-" + option.value}
                      type="radio"
                      name="lastSignal"
                      value={option.value}
                      checked={topDown.lastSignal === option.value}
                      onChange={handleChange("lastSignal")}
                      className="h-4 w-4 border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-sm text-slate-200">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-700 px-6 py-5 bg-slate-800/30">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Target POI HTF (Area Magnet Harga)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label
                htmlFor="obCheckbox"
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 transition hover:border-slate-600"
              >
                <input
                  id="obCheckbox"
                  type="checkbox"
                  checked={Boolean(topDown.ob)}
                  onChange={handleCheckbox("ob")}
                  className="h-5 w-5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                />
                <span className="text-sm font-medium text-slate-200">Order Block (OB)</span>
              </label>
              {topDown.ob && (
                <div>
                  <label htmlFor="obPrice" className="block text-xs font-medium text-slate-400 mb-1">
                    Harga OB (Rp)
                  </label>
                  <input
                    id="obPrice"
                    type="number"
                    value={topDown.obPrice || ""}
                    onChange={handleChange("obPrice")}
                    placeholder="e.g. 150000000"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <label
                htmlFor="fvgCheckbox"
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 transition hover:border-slate-600"
              >
                <input
                  id="fvgCheckbox"
                  type="checkbox"
                  checked={Boolean(topDown.fvg)}
                  onChange={handleCheckbox("fvg")}
                  className="h-5 w-5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                />
                <span className="text-sm font-medium text-slate-200">Fair Value Gap (FVG)</span>
              </label>
              {topDown.fvg && (
                <div>
                  <label htmlFor="fvgPrice" className="block text-xs font-medium text-slate-400 mb-1">
                    Harga FVG (Rp)
                  </label>
                  <input
                    id="fvgPrice"
                    type="number"
                    value={topDown.fvgPrice || ""}
                    onChange={handleChange("fvgPrice")}
                    placeholder="e.g. 150000000"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
