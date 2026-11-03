import { createHmac } from "node:crypto"

/**
 * Create an HMAC-SHA512 hex signature (Indodax v1 / tapi).
 *
 * @param {string} secretKey
 * @param {string} payload
 * @returns {string}
 */
export function signV1(secretKey, payload) {
  return createHmac("sha512", secretKey).update(payload, "utf8").digest("hex")
}

/**
 * Create an HMAC-SHA256 hex signature (Indodax v2).
 *
 * @param {string} secretKey
 * @param {string} payload
 * @returns {string}
 */
export function signV2(secretKey, payload) {
  return createHmac("sha256", secretKey).update(payload, "utf8").digest("hex")
}

/**
 * Build a deterministic, URL-encoded query string.
 * Keys are sorted alphabetically so the signed string equals the transmitted string.
 *
 * @param {Record<string, string | number | boolean | undefined>} params
 * @returns {string}
 */
export function buildQueryString(params) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort((a, b) => a[0].localeCompare(b[0]))
  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
}