import config from "../config.js"
import { IndodaxClient, IndodaxApiError } from "./client.js"
import { tradeLimiterFor, cancelLimiter, withRetry } from "./rateLimiter.js"

const client = new IndodaxClient({
  apiKey: config.indodax.apiKey,
  secretKey: config.indodax.secretKey,
  version: config.indodax.version,
  baseUrl: config.indodax.baseUrl,
  timeoutMs: config.indodax.timeoutMs,
})

function requireV2(fn) {
  return function (...args) {
    if (config.indodax.version !== "v2") {
      throw new IndodaxApiError("Authenticated v2 operations require INDODAX_API_VERSION=v2", { retryable: false })
    }
    return fn(...args)
  }
}

export const getAccountInfo = requireV2(async () => {
  return withRetry(() => client.signedRequest({ path: "/api/v2/account", httpMethod: "GET" }))
})

export const getBalance = requireV2(async (asset) => {
  const info = await getAccountInfo()
  const balances = info && (info.balances || info.balance || {})
  const key = String(asset).toUpperCase()
  return balances[key] || { asset: key, free: "0", locked: "0" }
})

export const placeLimitOrder = requireV2(async ({ symbol, side, price, quantity, clientOrderId }) => {
  await tradeLimiterFor(symbol).acquire()
  return withRetry(() =>
    client.signedRequest({
      path: "/api/v2/order",
      params: {
        symbol: String(symbol).toUpperCase(),
        side: String(side).toUpperCase(),
        type: "LIMIT",
        price: String(price),
        quantity: String(quantity),
        newClientOrderId: clientOrderId,
      },
      httpMethod: "POST",
    })
  )
})

export const placeMarketOrder = requireV2(async ({ symbol, side, quoteOrderQty }) => {
  await tradeLimiterFor(symbol).acquire()
  const params = {
    symbol: String(symbol).toUpperCase(),
    side: String(side).toUpperCase(),
    type: "MARKET",
  }
  if (String(side).toUpperCase() === "BUY" && quoteOrderQty !== undefined) {
    params.quoteOrderQty = String(quoteOrderQty)
  }
  return withRetry(() => client.signedRequest({ path: "/api/v2/order", params, httpMethod: "POST" }))
})

export const cancelOrder = requireV2(async ({ symbol, orderId }) => {
  await cancelLimiter.acquire()
  return withRetry(() =>
    client.signedRequest({
      path: "/api/v2/order",
      params: {
        symbol: String(symbol).toUpperCase(),
        orderId: String(orderId),
      },
      httpMethod: "DELETE",
    })
  )
})

export const getOpenOrders = requireV2(async (symbol) => {
  const params = symbol ? { symbol: String(symbol).toUpperCase() } : {}
  return withRetry(() => client.signedRequest({ path: "/api/v2/openOrders", params, httpMethod: "GET" }))
})

export const getOrder = requireV2(async ({ symbol, orderId }) => {
  return withRetry(() =>
    client.signedRequest({
      path: "/api/v2/order",
      params: {
        symbol: String(symbol).toUpperCase(),
        orderId: String(orderId),
      },
      httpMethod: "GET",
    })
  )
})

export const getOrderHistory = requireV2(async ({ symbol, startTime, endTime, limit = 100 }) => {
  const params = { symbol: String(symbol).toUpperCase() }
  if (startTime !== undefined) params.startTime = String(startTime)
  if (endTime !== undefined) params.endTime = String(endTime)
  params.limit = String(limit)
  return withRetry(() => client.signedRequest({ path: "/api/v2/order/histories", params, httpMethod: "GET" }))
})

export const getMyTrades = requireV2(async ({ symbol, limit = 100 }) => {
  return withRetry(() =>
    client.signedRequest({
      path: "/api/v2/myTrades",
      params: {
        symbol: String(symbol).toUpperCase(),
        limit: String(limit),
      },
      httpMethod: "GET",
    })
  )
})
