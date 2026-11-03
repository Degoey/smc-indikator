// Seeded deterministic PRNG so the demo chart is stable across reloads.
function mulberry32(seed) {
  let t = seed
  return function next() {
    t |= 0
    t = (t + 0x6D2B79F5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function dateToUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function generateDummyCandles(count = 100) {
  const rng = mulberry32(123456)

  const startDay = new Date(Date.UTC(2025, 0, 1))
  const candles = []

  let price = 150000
  let trend = 0
  let cycle = 0

  for (let i = 0; i < count; i++) {
    const r1 = rng()
    const r2 = rng()
    const r3 = rng()

    cycle += 0.12
    trend = Math.sin(cycle) * 3000 + Math.cos(cycle * 0.5) * 1500

    const volatility = 1200 + Math.abs(trend) * 0.2
    const spike = rng() > 0.92 ? (rng() - 0.5) * volatility * 2.5 : 0

    const change = (r1 - 0.5) * volatility + trend * 0.05 + spike
    const open = price
    const close = clamp(open + change, 1000, Number.MAX_SAFE_INTEGER)

    const bodyTop = Math.max(open, close)
    const bodyBottom = Math.min(open, close)

    const high = bodyTop + r2 * volatility * 0.6
    const low = bodyBottom - r3 * volatility * 0.6

    const day = new Date(startDay.getTime() + i * 24 * 60 * 60 * 1000)

    candles.push({
      time: dateToUnixSeconds(day),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    })

    price = close
  }

  return candles
}
