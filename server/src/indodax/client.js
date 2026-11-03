import { signV1, signV2, buildQueryString } from "./signature.js"
import config from "../config.js"
import { publicLimiter } from "./rateLimiter.js"

let globalNonce = 0

function getNextNonce() {
  const now = Date.now()
  globalNonce = Math.max(now, globalNonce + 1)
  return globalNonce
}



/** Retryable v2 error codes. */
const RETRYABLE_V2_CODES = new Set([-1001, -1003])

/** Terminal v2 error codes (do not retry). */
const TERMINAL_V2_CODES = new Set([
  -1002, -1021, -1022, -2014, -2015, -1121, -1102, -1130, -1111, -2010,
])

export class IndodaxApiError extends Error {
  constructor(message, { httpStatus, code, msg, retryable = false, retryAfterMs } = {}) {
    super(message)
    this.name = "IndodaxApiError"
    this.httpStatus = httpStatus
    this.code = code
    this.msg = msg
    this.retryable = retryable
    this.retryAfterMs = retryAfterMs
  }
}

function classifyV2Error(code) {
  const numeric = Number(code)
  return {
    retryable: RETRYABLE_V2_CODES.has(numeric),
    terminal: TERMINAL_V2_CODES.has(numeric),
  }
}

function classifyV1Error(errorText) {
  const text = String(errorText).toLowerCase()
  if (text.includes("too_many_requests")) return { retryable: true, terminal: false }
  if (text.includes("invalid_credentials")) return { retryable: false, terminal: true }
  if (text.includes("invalid_date")) return { retryable: true, terminal: false }
  return { retryable: false, terminal: false }
}

function extractRetryAfter(response) {
  const retryAfter = response.headers.get("retry-after")
  if (retryAfter) {
    const parsed = Number(retryAfter)
    if (Number.isFinite(parsed) && parsed > 0) return parsed * 1000
  }
  return undefined
}

export class IndodaxClient {
  constructor({ apiKey = "", secretKey = "", version = "v2", baseUrl = "https://api.indodax.com", timeoutMs = 10_000 } = {}) {
    this.apiKey = apiKey
    this.secretKey = secretKey
    this.version = version === "v1" ? "v1" : "v2"
    this.baseUrl = String(baseUrl).replace(/\/$/, "")
    this.publicBaseUrl = "https://indodax.com"
    this.timeoutMs = Number(timeoutMs) || 10_000
  }

  async _fetchWithTimeout(url, options = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      return response
    } finally {
      clearTimeout(timer)
    }
  }

  async publicGet(path) {
    await publicLimiter.acquire()
    const url = `${this.publicBaseUrl}${path}`
    let response
    try {
      response = await this._fetchWithTimeout(url, { method: "GET" })
    } catch (err) {
      if (err.name === "AbortError") {
        throw new IndodaxApiError("Public request timed out", { retryable: true })
      }
      throw new IndodaxApiError(err.message, { retryable: true })
    }

    if (!response.ok) {
      throw new IndodaxApiError(`Public request failed: ${response.status} ${response.statusText}`, {
        httpStatus: response.status,
        retryable: response.status === 429 || response.status >= 500,
      })
    }
    return response.json()
  }

  async signedRequest({ method, path, params = {}, httpMethod = "POST" }) {
    if (this.version === "v1") {
      return this._signedV1Request(method, params)
    }
    return this._signedV2Request({ path, params, httpMethod })
  }

  async _signedV2Request({ path, params = {}, httpMethod = "POST" }) {
    const timestamp = Date.now()
    const recvWindow = config.indodax.recvWindowMs
    const payload = { ...params, timestamp, recvWindow }

    let queryString = ""
    let bodyString = ""

    if (httpMethod === "GET") {
      queryString = buildQueryString(payload)
    } else {
      bodyString = buildQueryString(payload)
    }

    const signaturePayload = `${queryString}${bodyString}`
    const sign = signV2(this.secretKey, signaturePayload)

    const url = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ""}`
    const headers = {
      "X-APIKEY": this.apiKey,
      "Sign": sign,
    }

    const options = { method: httpMethod, headers }
    if (bodyString) {
      headers["Content-Type"] = "application/x-www-form-urlencoded"
      options.body = bodyString
    }

    let response
    try {
      response = await this._fetchWithTimeout(url, options)
    } catch (err) {
      if (err.name === "AbortError") {
        throw new IndodaxApiError("Request timed out", { retryable: true })
      }
      throw new IndodaxApiError(err.message, { retryable: true })
    }

    const retryAfterMs = extractRetryAfter(response)

    let body = {}
    try {
      body = await response.json()
    } catch {
      body = {}
    }

    if (!response.ok) {
      const code = body && body.code
      const { retryable } = classifyV2Error(code)
      const msg = (body && (body.msg || body.message || body.error)) || `HTTP ${response.status}`
      throw new IndodaxApiError(msg, {
        httpStatus: response.status,
        code,
        msg,
        retryable: retryable || response.status === 429 || response.status >= 500,
        retryAfterMs,
      })
    }

    if (body && body.code !== undefined && body.code !== 0 && body.code !== 200 && body.code !== "0") {
      const code = body.code
      const { retryable } = classifyV2Error(code)
      throw new IndodaxApiError(body.msg || body.message || "API error", {
        httpStatus: response.status,
        code,
        msg: body.msg || body.message,
        retryable,
        retryAfterMs,
      })
    }

    return body
  }

  async _signedV1Request(method, params = {}) {
    const nonce = getNextNonce()
    const bodyParams = { method, nonce, ...params }
    const bodyString = buildQueryString(bodyParams)
    const sign = signV1(this.secretKey, bodyString)

    const url = `${this.publicBaseUrl}/tapi`
    const headers = {
      "Key": this.apiKey,
      "Sign": sign,
      "Content-Type": "application/x-www-form-urlencoded",
    }

    let response
    try {
      response = await this._fetchWithTimeout(url, { method: "POST", headers, body: bodyString })
    } catch (err) {
      if (err.name === "AbortError") {
        throw new IndodaxApiError("Request timed out", { retryable: true })
      }
      throw new IndodaxApiError(err.message, { retryable: true })
    }

    const retryAfterMs = extractRetryAfter(response)

    let body = {}
    try {
      body = await response.json()
    } catch {
      body = {}
    }

    if (!response.ok) {
      const { retryable } = classifyV1Error(body && body.error)
      throw new IndodaxApiError(body.error || `HTTP ${response.status}`, {
        httpStatus: response.status,
        code: body.error,
        msg: body.error,
        retryable: retryable || response.status === 429 || response.status >= 500,
        retryAfterMs,
      })
    }

    if (body.success === 0) {
      const errorText = body.error || body.message || "v1 API error"
      const { retryable } = classifyV1Error(errorText)
      throw new IndodaxApiError(errorText, {
        httpStatus: response.status,
        code: errorText,
        msg: errorText,
        retryable,
        retryAfterMs,
      })
    }

    return body
  }

  async checkClockSkew() {
    const serverTimeRes = await this.publicGet("/api/server_time")
    const serverTimeMs = Number(serverTimeRes && serverTimeRes.server_time) * 1000
    if (!Number.isFinite(serverTimeMs)) {
      throw new IndodaxApiError("Unable to parse server time")
    }
    const localTimeMs = Date.now()
    const skew = localTimeMs - serverTimeMs
    if (Math.abs(skew) > 1000) {
      console.warn(`[IndodaxClient] Clock skew detected: ${skew}ms (local - server)`)
    }
    return { skew, serverTimeMs, localTimeMs }
  }
}
