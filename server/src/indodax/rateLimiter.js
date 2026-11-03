/**
 * Token-bucket rate limiter.
 */
export class RateLimiter {
  /**
   * @param {{ capacity: number, refillPerSecond: number }} options
   */
  constructor({ capacity, refillPerSecond }) {
    this.capacity = capacity
    this.refillPerSecond = refillPerSecond
    this.tokens = capacity
    this.lastRefill = performance.now()
  }

  /**
   * Wait until a token is available and consume it.
   * @returns {Promise<void>}
   */
  async acquire() {
    this._refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }
    const waitMs = (1 - this.tokens) / this.refillPerSecond * 1000
    await sleep(waitMs)
    return this.acquire()
  }

  /**
   * Try to acquire a token without waiting.
   * @returns {boolean}
   */
  tryAcquire() {
    this._refill()
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }

  _refill() {
    const now = performance.now()
    const elapsed = (now - this.lastRefill) / 1000
    const added = elapsed * this.refillPerSecond
    if (added >= 1) {
      this.tokens = Math.min(this.capacity, this.tokens + added)
      this.lastRefill = now
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitteredDelay(baseDelayMs, maxDelayMs) {
  const delay = Math.min(baseDelayMs, maxDelayMs)
  const j = Math.random() * 0.2 * delay
  return Math.floor(delay + j)
}

/**
 * Retry a function with exponential backoff + jitter.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, baseDelayMs?: number, maxDelayMs?: number }} [options]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { retries = 3, baseDelayMs = 500, maxDelayMs = 60_000 } = {}) {
  let attempt = 0
  let lastError
  while (attempt <= retries) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt >= retries) throw err
      const isRetryable = err && err.retryable === true
      if (!isRetryable) throw err

      const retryAfter = Number(err.retryAfterMs) || 0
      const base = baseDelayMs * 2 ** attempt
      const delay = retryAfter > 0 ? retryAfter : jitteredDelay(base, maxDelayMs)
      await sleep(delay)
      attempt += 1
    }
  }
  throw lastError
}

export const publicLimiter = new RateLimiter({ capacity: 180, refillPerSecond: 180 / 60 })
export const cancelLimiter = new RateLimiter({ capacity: 30, refillPerSecond: 30 })

const tradeLimiters = new Map()

/**
 * Get (or create) the per-pair trade rate limiter.
 * @param {string} pair
 * @returns {RateLimiter}
 */
export function tradeLimiterFor(pair) {
  const key = String(pair).toUpperCase()
  if (!tradeLimiters.has(key)) {
    tradeLimiters.set(key, new RateLimiter({ capacity: 20, refillPerSecond: 20 }))
  }
  return tradeLimiters.get(key)
}

export default { RateLimiter, publicLimiter, cancelLimiter, tradeLimiterFor, withRetry }