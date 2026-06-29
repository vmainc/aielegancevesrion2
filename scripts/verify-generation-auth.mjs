#!/usr/bin/env node
/**
 * PASS 3 — Secure generation endpoints (static checks).
 * Run: node scripts/verify-generation-auth.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read (rel) {
  return readFileSync(join(root, rel), 'utf8')
}

const checks = []

function assert (name, ok, detail = '') {
  checks.push({ name, ok, detail })
}

const protectedRoutes = [
  'server/api/generate/image.post.ts',
  'server/api/generate/video.post.ts',
  'server/api/generate-character.post.ts',
  'server/api/generate/video/status.get.ts'
]

for (const file of protectedRoutes) {
  const src = read(file)
  assert(`server: ${file} requires user session`, src.includes('getPocketBaseUserIdFromRequest'))
  const handlerStart = src.indexOf('defineEventHandler')
  const handlerBody = handlerStart === -1 ? src : src.slice(handlerStart)
  const authInHandler = handlerBody.includes('getPocketBaseUserIdFromRequest')
  const providerCall = /openRouterGenerate|pollOpenRouterVideoOnce/.test(handlerBody)
  const authBeforeProvider =
    !providerCall ||
    handlerBody.indexOf('getPocketBaseUserIdFromRequest') <
      Math.min(
        ...['openRouterGenerate', 'pollOpenRouterVideoOnce']
          .map(k => handlerBody.indexOf(k))
          .filter(i => i !== -1)
      )
  assert(`server: ${file} authenticates before provider calls`, authInHandler && authBeforeProvider)
}

const status = read('server/api/generate/video/status.get.ts')
assert('server: video status checks job userId', status.includes('job.userId !== userId'))

const registry = read('server/utils/video-generation-job-registry.ts')
const videoPost = read('server/api/generate/video.post.ts')
assert('server: video jobs store userId', registry.includes('userId: string') && videoPost.includes('userId'))

const videoGen = read('composables/useOpenRouterVideoGen.ts')
assert('client: video composable sends Bearer token', videoGen.includes('pocketBaseBearerHeaders'))

for (const file of [
  'pages/projects/[projectId]/storyboard.vue',
  'pages/character-creator.vue',
  'components/video/VideoStartFramePicker.vue'
]) {
  const src = read(file)
  assert(
    `client: ${file} sends auth to /api/generate/image`,
    src.includes('/api/generate/image') &&
      (src.includes('Authorization') || src.includes('pocketBaseBearerHeaders'))
  )
}

assert('shared auth header helper', read('lib/pocketbase-auth-headers.ts').includes('pocketBaseBearerHeaders'))

let failed = 0
for (const c of checks) {
  const mark = c.ok ? '✓' : '✗'
  console.log(`${mark} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
  if (!c.ok) failed++
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}

console.log(`\nAll ${checks.length} generation auth checks passed.`)
