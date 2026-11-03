import { useState } from "react"
import GateAwal from "./components/GateAwal"
import InitialSettings from "./components/InitialSettings"
import TopDownAnalysis from "./components/TopDownAnalysis"
import PenyapuanLikuiditas from "./components/PenyapuanLikuiditas"
import KonfirmasiLTF from "./components/KonfirmasiLTF"
import SetupInvalidasi from "./components/SetupInvalidasi"
import ParameterOrder from "./components/ParameterOrder"
import FinalSummary from "./components/FinalSummary"
import SmcChart from "./components/SmcChart"
import LiveMarketData from "./components/LiveMarketData"
import CoinSelector from "./components/CoinSelector"

function App() {
  const [gatePassed, setGatePassed] = useState(false)

  const [modal, setModal] = useState("")
  const [maxRisk, setMaxRisk] = useState("")

  const [assetPair, setAssetPair] = useState("")

  const [sweepAnswers, setSweepAnswers] = useState({
    htfCandleRejection: "",
    sweepAfterPoi: "",
  })

  const [ltfFilters, setLtfFilters] = useState({
    reaksiHtfPoi: false,
    chochLtf: false,
    poiLtfBaru: false,
  })

  const [invalidations, setInvalidations] = useState({
    slBreached: false,
    structureFailed: false,
  })

  const [orderType, setOrderType] = useState("buy")

  const [entry, setEntry] = useState("")
  const [stopLoss, setStopLoss] = useState("")
  const [takeProfit, setTakeProfit] = useState("")

  const sweepAnsweredAll =
    sweepAnswers.htfCandleRejection !== "" && sweepAnswers.sweepAfterPoi !== ""
  const sweepAllYes =
    sweepAnswers.htfCandleRejection === "ya" && sweepAnswers.sweepAfterPoi === "ya"

  const sweepStatus = !sweepAnsweredAll
    ? null
    : sweepAllYes
      ? "Sudah Disapu"
      : "Belum Tersapu"

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100">
      <header className="w-full border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M3.75 3a.75.75 0 01.75-.75h9.75a.75.75 0 010 1.5H5.25v14.25a.75.75 0 01-1.5 0V3z" clipRule="evenodd" />
                <path d="M15 6.75a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75V6.75z" />
                <path d="M18 9.75a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75V9.75z" />
                <path d="M14.25 12.75a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75v-.008z" />
                <path d="M10.5 15.75a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75v-.008z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-100">SMC Trading Checklist App</h1>
              <p className="text-xs text-emerald-400">SPOT Market Only</p>
            </div>
          </div>
        </div>
      </header>

      <LiveMarketData />
      <CoinSelector selectedSymbol={assetPair} onSelect={setAssetPair} />

      <GateAwal onValidationChange={setGatePassed} />

      <div className={`transition duration-300 ${gatePassed ? "opacity-100 pointer-events-auto" : "opacity-40 pointer-events-none"}`}>
        <InitialSettings
          modal={modal}
          setModal={setModal}
          maxRisk={maxRisk}
          setMaxRisk={setMaxRisk}
        />
        <TopDownAnalysis assetPair={assetPair} setAssetPair={setAssetPair} />
        <PenyapuanLikuiditas answers={sweepAnswers} setAnswers={setSweepAnswers} />
        <KonfirmasiLTF filters={ltfFilters} setFilters={setLtfFilters} />
        <SetupInvalidasi
          entry={entry}
          setEntry={setEntry}
          stopLoss={stopLoss}
          setStopLoss={setStopLoss}
          takeProfit={takeProfit}
          setTakeProfit={setTakeProfit}
          invalidations={invalidations}
          setInvalidations={setInvalidations}
        />
        <ParameterOrder
          entry={entry}
          stopLoss={stopLoss}
          takeProfit={takeProfit}
          modal={modal}
          maxRisk={maxRisk}
          orderType={orderType}
          setOrderType={setOrderType}
        />
        <FinalSummary
          assetPair={assetPair}
          entry={entry}
          stopLoss={stopLoss}
          takeProfit={takeProfit}
          gatePassed={gatePassed}
          sweepStatus={sweepStatus}
          reaksiHtfPoi={ltfFilters.reaksiHtfPoi}
          chochLtf={ltfFilters.chochLtf}
          poiLtfBaru={ltfFilters.poiLtfBaru}
          invalidations={invalidations}
        />
      </div>

      <SmcChart symbol={assetPair} />
    </main>
  )
}

export default App
