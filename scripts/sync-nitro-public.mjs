/**
 * Nitro (node-server) resolves static assets under .output/server/chunks/public
 * (paths like ../public/_nuxt/* relative to nitro.mjs). Sync from .output/public after build.
 */
import { cp, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, '.output', 'public')
const dest = path.join(root, '.output', 'server', 'chunks', 'public')

if (!existsSync(src)) {
  console.warn('sync-nitro-public: skip — .output/public missing (run nuxt build first)')
  process.exit(0)
}

await mkdir(path.join(root, '.output', 'server', 'chunks'), { recursive: true })
await cp(src, dest, { recursive: true, force: true })
console.log('sync-nitro-public: copied .output/public → .output/server/chunks/public')
