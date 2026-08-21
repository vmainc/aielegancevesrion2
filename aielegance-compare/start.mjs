/**
 * Production entry: load /var/www/aielegance-com/.env then Nitro.
 * Always bind 127.0.0.1:3001 so we never collide with Film Studio on :3000.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile (file) {
  try {
    const raw = readFileSync(file, 'utf8')
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      if (k && process.env[k] == null) process.env[k] = v
    }
  } catch {
    /* .env optional for boot; compare API needs OPENROUTER_API_KEY */
  }
}

loadEnvFile(resolve(process.cwd(), '.env'))
process.env.HOST = process.env.HOST || '127.0.0.1'
process.env.PORT = process.env.PORT || '3001'
process.env.NITRO_HOST = process.env.NITRO_HOST || process.env.HOST
process.env.NITRO_PORT = process.env.NITRO_PORT || process.env.PORT
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

await import('./.output/server/index.mjs')
