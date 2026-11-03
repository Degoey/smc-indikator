import { execFile } from "node:child_process"
import { readdirSync } from "node:fs"
import { resolve, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const srcDir = resolve(__dirname, "..", "src")

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(path)
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      yield path
    }
  }
}

const files = [...walk(srcDir)]
let failed = 0

for (const file of files) {
  try {
    await new Promise((resolve, reject) => {
      execFile(process.execPath, ["--check", file], (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message))
        else resolve()
      })
    })
    console.log(`OK: ${file}`)
  } catch (err) {
    failed++
    console.error(`FAIL: ${file}`)
    console.error(err.message)
  }
}

if (failed > 0) {
  console.error(`${failed} file(s) failed syntax check`)
  process.exit(1)
}

console.log("All files passed syntax check")
