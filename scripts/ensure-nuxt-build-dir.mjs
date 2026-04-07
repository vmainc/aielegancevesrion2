#!/usr/bin/env node
/**
 * Nuxt dev sometimes fails with ENOENT mkdir '.nuxt/schema' if:
 * - `.nuxt` exists as a file (not a directory), or
 * - permissions are wrong after sudo/Docker builds.
 * Run automatically before `npm run dev` via predev.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const nuxtDir = path.join(root, '.nuxt')
const schemaDir = path.join(nuxtDir, 'schema')

try {
  const st = fs.lstatSync(nuxtDir)
  if (!st.isDirectory()) {
    fs.unlinkSync(nuxtDir)
  }
} catch (e) {
  if (e && e.code !== 'ENOENT') throw e
}

fs.mkdirSync(schemaDir, { recursive: true })
