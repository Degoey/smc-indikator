import { useMemo } from "react"

export default function ParameterOrder({
  entry,
  stopLoss,
  takeProfit,
  modal,
  maxRisk,
  orderType,
  setOrderType,
}) {
  const entryNum = parseFloat(entry)
  const slNum = parseFloat(stopLoss)
  const modalNum = parseFloat(modal)
  const riskPctNum = parseFloat(maxRisk)

  const riskAmount = useMemo(() => {
    if (!modal || !maxRisk || modalNum <= 0 || riskPctNum < 0) return null
    const value = modalNum * (riskPctNum / 100)
    return Number.isFinite(value) ? value : null
  }, [modal, modalNum, maxRisk, riskPctNum])

  const slDistance = useMemo(() => {
    if (entry === "" || stopLoss === "") return null
    if (!Number.isFinite(entryNum) || !Number.isFinite(slNum)) return null
    return Math.abs(entryNum - slNum)
  }, [entry, stopLoss, entryNum, slNum])

  const coinAmount = useMemo(() => {
    if (riskAmount === null || slDistance === null || slDistance === 0) return null
    const value = riskAmount / slDistance
    return Number.isFinite(value) && value > 0 ? value : null
  }, [riskAmount, slDistance])

  const orderOptions = [
    { id: "buy", label: "Buy Limit" },
    { id: "sell", label: "Sell Limit" },
  ]

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm shadow-xl">
        <div className="border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
            Section 5: PARAMETER ORDER
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Konfirmasi parameter order dan perhitungan otomatis lot/koin.
          </p>
        </div>

        <div className="p-6 space-y-8">
          <div className="space-y-3">
            <span className="block text-sm font-medium text-slate-300">Jenis Order</span>
            <div className="flex flex-wrap gap-4">
              {orderOptions.map((option) => (
                <label
                  key={option.id}
                  htmlFor={`order-${option.id}`}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 transition hover:border-slate-600"
                >
                  <input
                    id={`order-${option.id}`}
                    type="radio"
                    name="orderType"
                    value={option.id}
                    checked={orderType === option.id}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="h-4 w-4 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 border-slate-600"
                  />
                  <span className="text-sm font-medium text-slate-200">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label htmlFor="paramEntry" className="block text-sm font-medium text-slate-300">
                Entry Price (Rp)
              </label>
              <input
                id="paramEntry"
                type="number"
                value={entry}
                disabled
                readOnly
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="paramSL" className="block text-sm font-medium text-slate-300">
                Stop Loss (Rp)
              </label>
              <input
                id="paramSL"
                type="number"
                value={stopLoss}
                disabled
                readOnly
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="paramTP" className="block text-sm font-medium text-slate-300">
                Take Profit (Rp)
              </label>
              <input
                id="paramTP"
                type="number"
                value={takeProfit}
                disabled
                readOnly
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">
              Automatic Lot / Coin Size Calculator
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Risk Amount (Rp)</p>
                <p className="text-lg font-semibold text-slate-100">
                  {riskAmount !== null ? riskAmount.toLocaleString("id-ID") : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">SL Distance (Rp)</p>
                <p className="text-lg font-semibold text-slate-100">
                  {slDistance !== null ? slDistance.toLocaleString("id-ID") : "—"}
                </p>
              </div>
              <div className="space-y-1 md:col-span-2 lg:col-span-2">
                <p className="text-xs text-slate-400">Jumlah Koin</p>
                <p className="text-4xl font-extrabold text-emerald-400 drop-shadow">
                  {coinAmount !== null ? coinAmount.toLocaleString("id-ID", { maximumFractionDigits: 8 }) : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
