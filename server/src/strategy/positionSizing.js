/**
 * Calculate position size based on balance, risk percent, and stop-loss distance.
 *
 * @param {object} input
 * @param {number} input.balanceIdr - Account balance in IDR.
 * @param {number} input.maxRiskPct - Maximum risk as a percentage (e.g. 2 for 2%).
 * @param {number} input.entry - Entry price.
 * @param {number} input.stopLoss - Stop-loss price.
 * @param {object} [input.pairRules] - Pair rules from /api/pairs.
 * @param {number} [input.pairRules.pricePrecision]
 * @param {number} [input.pairRules.pricescale]
 * @param {number} [input.pairRules.quantityIncrement]
 * @param {number} [input.pairRules.tradeMinBaseCurrency]
 * @param {number} [input.pairRules.tradeMinTradedCurrency]
 * @returns {{ riskAmountIdr: number, slDistance: number, rawQuantity: number, quantity: number, notionalIdr: number } | { reason: string }}
 */
export function calculatePositionSize({ balanceIdr, maxRiskPct, entry, stopLoss, pairRules = {} }) {
  const balance = Number(balanceIdr)
  const riskPct = Number(maxRiskPct)
  const entryNum = Number(entry)
  const slNum = Number(stopLoss)

  if (!Number.isFinite(balance) || balance <= 0) {
    return { reason: "Invalid balance" }
  }
  if (!Number.isFinite(riskPct) || riskPct <= 0) {
    return { reason: "Invalid risk percentage" }
  }
  if (!Number.isFinite(entryNum) || entryNum <= 0) {
    return { reason: "Invalid entry price" }
  }
  if (!Number.isFinite(slNum) || slNum <= 0) {
    return { reason: "Invalid stop loss price" }
  }

  const slDistance = Math.abs(entryNum - slNum)
  if (slDistance === 0) {
    return { reason: "Entry equals stop loss" }
  }

  const riskAmountIdr = balance * (riskPct / 100)
  const rawQuantity = riskAmountIdr / slDistance

  const pricescale = Number(pairRules.pricescale) || 0
  const quantityIncrement = Number(pairRules.quantityIncrement) || 0
  const tradeMinBaseCurrency = Number(pairRules.tradeMinBaseCurrency) || 0
  const tradeMinTradedCurrency = Number(pairRules.tradeMinTradedCurrency) || 0
  const pricePrecision = Number(pairRules.pricePrecision) || 0

  let quantity = rawQuantity
  if (quantityIncrement > 0) {
    quantity = Math.floor(rawQuantity / quantityIncrement) * quantityIncrement
  }

  let roundedEntry = entryNum
  if (pricescale > 0) {
    const factor = 10 ** pricePrecision
    roundedEntry = Math.round(entryNum * factor) / factor
  }

  const notionalIdr = quantity * roundedEntry

  if (tradeMinBaseCurrency > 0 && quantity < tradeMinBaseCurrency) {
    return { reason: `Quantity below minimum base currency (${tradeMinBaseCurrency})` }
  }
  if (tradeMinTradedCurrency > 0 && notionalIdr < tradeMinTradedCurrency) {
    return { reason: `Notional below minimum traded currency (${tradeMinTradedCurrency})` }
  }

  return {
    riskAmountIdr,
    slDistance,
    rawQuantity,
    quantity,
    notionalIdr,
  }
}
