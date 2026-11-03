/**
 * Evaluate the SMC checklist and return a trading decision.
 *
 * @param {object} input
 * @param {boolean} [input.gatePassed]
 * @param {boolean} [input.sweepConfirmed]
 * @param {boolean} [input.chochLtf]
 * @param {number} [input.ltfFilterCount]
 * @param {boolean} [input.invalidated]
 * @param {number} input.entry
 * @param {number} input.stopLoss
 * @param {number} input.takeProfit
 * @returns {{ action: "SET_LIMIT" | "WAIT" | "CANCEL", reason: string, entry: number, stopLoss: number, takeProfit: number, rr: number | null, side: "LONG" | "SHORT" | null }}
 */
export function evaluateSetup(input) {
  const {
    gatePassed = false,
    sweepConfirmed = false,
    chochLtf = false,
    ltfFilterCount = 0,
    invalidated = false,
    entry,
    stopLoss,
    takeProfit,
  } = input

  const entryNum = Number(entry)
  const slNum = Number(stopLoss)
  const tpNum = Number(takeProfit)

  let side = null
  if (Number.isFinite(entryNum) && Number.isFinite(slNum)) {
    if (entryNum > slNum) side = "LONG"
    else if (entryNum < slNum) side = "SHORT"
  }

  const slDistance = Math.abs(entryNum - slNum)
  let rr = null
  if (Number.isFinite(entryNum) && Number.isFinite(slNum) && Number.isFinite(tpNum) && slDistance > 0) {
    rr = Math.abs(entryNum - tpNum) / slDistance
  }

  if (!gatePassed || !sweepConfirmed || invalidated) {
    return {
      action: "CANCEL",
      reason: buildCancelReason({ gatePassed, sweepConfirmed, invalidated }),
      entry: entryNum,
      stopLoss: slNum,
      takeProfit: tpNum,
      rr,
      side,
    }
  }

  if (!chochLtf) {
    return {
      action: "WAIT",
      reason: "CHoCH LTF not yet confirmed",
      entry: entryNum,
      stopLoss: slNum,
      takeProfit: tpNum,
      rr,
      side,
    }
  }

  if (ltfFilterCount < 2) {
    return {
      action: "WAIT",
      reason: `Only ${ltfFilterCount} LTF filters confirmed (need >= 2)`,
      entry: entryNum,
      stopLoss: slNum,
      takeProfit: tpNum,
      rr,
      side,
    }
  }

  if (!Number.isFinite(rr) || rr < 2) {
    return {
      action: "WAIT",
      reason: `RR ratio ${rr} below 2.0`,
      entry: entryNum,
      stopLoss: slNum,
      takeProfit: tpNum,
      rr,
      side,
    }
  }

  return {
    action: "SET_LIMIT",
    reason: "Gate, sweep, CHoCH, LTF filters, and RR >= 2 all confirmed",
    entry: entryNum,
    stopLoss: slNum,
    takeProfit: tpNum,
    rr,
    side,
  }
}

function buildCancelReason({ gatePassed, sweepConfirmed, invalidated }) {
  const reasons = []
  if (!gatePassed) reasons.push("gate not passed")
  if (!sweepConfirmed) reasons.push("sweep not confirmed")
  if (invalidated) reasons.push("setup invalidated")
  return reasons.join("; ") || "setup cancelled"
}
