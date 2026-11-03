import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Read a `.env` file and load its values into process.env.
 * Existing environment variables are never overwritten.
 * Supports simple KEY=VALUE lines, comments, and `export ` prefix.
 *
 * @param {string} path
 */
export function loadEnvFile(path) {
  if (!existsSync(path)) return
  const raw = readFileSync(path, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^export\s+(.+)$/)
    const body = match ? match[1] : trimmed
    const eqIndex = body.indexOf("=")
    if (eqIndex === -1) continue
    const key = body.slice(0, eqIndex).trim()
    let value = body.slice(eqIndex + 1)
    value = value.replace(/^["']/, "").replace(/["']$/, "")
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

const rootEnv = resolve(__dirname, "..", ".env")
const serverEnv = resolve(__dirname, ".env")
loadEnvFile(rootEnv)
loadEnvFile(serverEnv)

function bool(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue
  return /^\s*(true|1|yes|on)\s*$/i.test(String(value))
}

function num(value, defaultValue, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return defaultValue
  let v = n
  if (min !== undefined) v = Math.max(min, v)
  if (max !== undefined) v = Math.min(max, v)
  return v
}

export const config = {
  indodax: {
    apiKey: process.env.INDODAX_API_KEY || "",
    secretKey: process.env.INDODAX_SECRET_KEY || "",
    version: process.env.INDODAX_API_VERSION || "v2",
    baseUrl: process.env.INDODAX_BASE_URL || "https://api.indodax.com",
    publicBaseUrl: "https://indodax.com",
    timeoutMs: num(process.env.TIMEOUT_MS, 10_000, 1_000, 120_000),
    recvWindowMs: num(process.env.RECV_WINDOW_MS, 5_000, 1_000, 60_000),
  },
  trading: {
    pair: (process.env.TRADING_PAIR || "BTCIDR").toUpperCase(),
    maxRiskPct: num(process.env.MAX_RISK_PCT, 2, 0.01, 100),
  },
  bot: {
    enabled: bool(process.env.BOT_ENABLED, false),
    dryRun: bool(process.env.DRY_RUN, true),
    intervalMs: num(process.env.BOT_INTERVAL_MS, 60_000, 5_000, 3_600_000),
    clockSkewIntervalMs: num(process.env.BOT_CLOCK_SKEW_INTERVAL_MS, 300_000, 60_000, 3_600_000),
    cancelOnShutdown: bool(process.env.CANCEL_ON_SHUTDOWN, false),
  },
  server: {
    port: num(process.env.PORT, 8787, 1, 65_535),
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  },
  logLevel: (process.env.LOG_LEVEL || "info").toLowerCase(),
}

const hasKeys = config.indodax.apiKey && config.indodax.secretKey
config.indodax.hasCredentials = hasKeys

/**
 * Validate that required credentials are present for authenticated calls.
 * @returns {{ok: boolean, missing: string[]}}
 */
export function validateCredentials() {
  const missing = []
  if (!config.indodax.apiKey) missing.push("INDODAX_API_KEY")
  if (!config.indodax.secretKey) missing.push("INDODAX_SECRET_KEY")
  return { ok: missing.length === 0, missing }
}

export default config