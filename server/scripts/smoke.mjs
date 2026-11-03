import assert from "node:assert"
import { signV2, buildQueryString } from "../src/indodax/signature.js"
import { RateLimiter } from "../src/indodax/rateLimiter.js"
import { calculatePositionSize } from "../src/strategy/positionSizing.js"
import { evaluateSetup } from "../src/strategy/smcStrategy.js"

function test(name, fn) {
  try {
    fn()
    console.log(`PASS: ${name}`)
  } catch (err) {
    console.error(`FAIL: ${name}`)
    console.error(err)
    process.exitCode = 1
  }
}

test("signV2 produces a 64-character hex string and is deterministic", () => {
  const signature = signV2("secret", "payload")
  assert.strictEqual(typeof signature, "string")
  assert.strictEqual(signature.length, 64)
  assert.strictEqual(signature, signV2("secret", "payload"))
})

test("buildQueryString is deterministic and URL encodes values", () => {
  const qs = buildQueryString({ b: 2, a: 1, c: "hello world" })
  assert.strictEqual(qs, "a=1&b=2&c=hello%20world")
})

test("token bucket blocks then allows", async () => {
  const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 10 })
  await limiter.acquire()
  const start = Date.now()
  await limiter.acquire()
  const elapsed = Date.now() - start
  assert.ok(elapsed >= 80 && elapsed <= 250, `elapsed was ${elapsed}ms`)
})

test("position sizing returns expected quantity for known input", () => {
  const result = calculatePositionSize({
    balanceIdr: 10_000_000,
    maxRiskPct: 2,
    entry: 1000,
    stopLoss: 990,
    pairRules: {
      quantityIncrement: 1,
      pricePrecision: 0,
      tradeMinBaseCurrency: 0,
      tradeMinTradedCurrency: 0,
    },
  })
  assert.strictEqual(result.riskAmountIdr, 200_000)
  assert.strictEqual(result.slDistance, 10)
  assert.strictEqual(result.quantity, 20_000)
})

test("evaluateSetup returns CANCEL when gate fails", () => {
  const result = evaluateSetup({
    gatePassed: false,
    sweepConfirmed: true,
    chochLtf: true,
    ltfFilterCount: 2,
    entry: 1000,
    stopLoss: 990,
    takeProfit: 1020,
  })
  assert.strictEqual(result.action, "CANCEL")
})

test("evaluateSetup returns SET_LIMIT when all conditions pass", () => {
  const result = evaluateSetup({
    gatePassed: true,
    sweepConfirmed: true,
    chochLtf: true,
    ltfFilterCount: 2,
    entry: 1000,
    stopLoss: 990,
    takeProfit: 1020,
    invalidated: false,
  })
  assert.strictEqual(result.action, "SET_LIMIT")
  assert.strictEqual(result.side, "LONG")
})

test("evaluateSetup returns WAIT when only CHoCH is missing", () => {
  const result = evaluateSetup({
    gatePassed: true,
    sweepConfirmed: true,
    chochLtf: false,
    ltfFilterCount: 3,
    entry: 1000,
    stopLoss: 990,
    takeProfit: 1020,
  })
  assert.strictEqual(result.action, "WAIT")
})
