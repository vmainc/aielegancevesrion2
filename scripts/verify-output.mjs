#!/usr/bin/env node
/**
 * Fail if Nitro static assets are not in the place node-server reads from.
 * Run after: npm run build
 */
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nuxtDir = path.join(root, '.output', 'server', 'chunks', 'public', '_nuxt')

if (!existsSync(nuxtDir)) {
  console.error('verify-output: missing', nuxtDir, '— run npm run build (not nuxt build alone)')
  process.exit(1)
}

const files = readdirSync(nuxtDir)
if (files.length < 5) {
  console.error('verify-output: _nuxt looks empty or incomplete:', nuxtDir)
  process.exit(1)
}

console.log('verify-output: OK —', files.length, 'entries under _nuxt')
