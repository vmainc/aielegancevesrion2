#!/usr/bin/env node
/**
 * Fail if shipped client chunks still reference the Vite dev client (breaks CSS/JS in production).
 * After sync-nitro-public, assets live under .output/server/chunks/public/_nuxt (node-server preset).
 * Do not probe nitro.mjs — Nuxt 3.17+ can mention vite tooling there without shipping @vite/client to the browser.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const nuxtDirs = [
  path.join(root, '.output', 'server', 'chunks', 'public', '_nuxt'),
  path.join(root, '.output', 'public', '_nuxt')
]

for (const dir of nuxtDirs) {
  if (!existsSync(dir)) continue
  const names = readdirSync(dir)
  for (const name of names) {
    if (!/\.(js|mjs)$/i.test(name)) continue
    const filePath = path.join(dir, name)
    const text = readFileSync(filePath, 'utf8')
    if (text.includes('@vite/client')) {
      console.error(
        'verify-production-bundle: client chunk references @vite/client:',
        path.relative(root, filePath)
      )
      process.exit(1)
    }
  }
  console.log(
    'verify-production-bundle: OK — no @vite/client in',
    path.relative(root, dir)
  )
  process.exit(0)
}

const manifestPath = path.join(
  root,
  '.output',
  'server',
  'chunks',
  'build',
  'client.manifest.mjs'
)
if (existsSync(manifestPath)) {
  const text = readFileSync(manifestPath, 'utf8')
  if (text.includes('@vite/client')) {
    console.error(
      'verify-production-bundle: client.manifest.mjs still references @vite/client.'
    )
    process.exit(1)
  }
  console.log('verify-production-bundle: OK (client.manifest.mjs, no _nuxt dir yet)')
  process.exit(0)
}

console.error(
  'verify-production-bundle: missing _nuxt under .output and no client.manifest.mjs — run npm run build'
)
process.exit(1)
