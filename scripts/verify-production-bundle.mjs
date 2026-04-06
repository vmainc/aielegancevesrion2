#!/usr/bin/env node
/**
 * Fail if Nitro output still references Vite dev client (would break CSS/JS on production).
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(
  root,
  '.output',
  'server',
  'chunks',
  'build',
  'client.manifest.mjs'
)
const nitroPath = path.join(
  root,
  '.output',
  'server',
  'chunks',
  'nitro',
  'nitro.mjs'
)

let text = ''
if (existsSync(manifestPath)) {
  text = readFileSync(manifestPath, 'utf8')
} else if (existsSync(nitroPath)) {
  // Nuxt 3.17+ may omit client.manifest.mjs when experimental.appManifest is false; probe Nitro instead.
  text = readFileSync(nitroPath, 'utf8')
} else {
  console.error('verify-production-bundle: missing', manifestPath, 'and', nitroPath)
  process.exit(1)
}
// Dev-only HMR client must never ship in .output (unstyled site + broken scripts).
if (text.includes('@vite/client')) {
  console.error(
    'verify-production-bundle: output still references @vite/client (dev bundle).',
    'Fix: rm -rf .nuxt .output && NUXT_PUBLIC_POCKETBASE_URL=https://aielegance.com/pb npm run build'
  )
  process.exit(1)
}

console.log('verify-production-bundle: OK (no dev asset paths in client manifest)')
