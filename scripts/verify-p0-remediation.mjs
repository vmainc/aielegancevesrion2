#!/usr/bin/env node
/**
 * Static verification for P0 architectural remediation.
 * Run: node scripts/verify-p0-remediation.mjs
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

// 1. Continuity wired into shot generation
const executeShots = read('server/utils/execute-generate-shots.ts')
assert(
  'continuity: checkShotsContinuity imported in execute-generate-shots',
  executeShots.includes('checkShotsContinuity') && executeShots.includes("from '~/server/utils/continuity-check-ai'")
)
assert(
  'continuity: no hardcoded clean result',
  !executeShots.includes('continuity: { issueCount: 0, memoryUpdated: false }')
)
assert(
  'continuity: persistContinuityCheckOnProject used',
  executeShots.includes('persistContinuityCheckOnProject')
)
assert(
  'continuity: logging present',
  executeShots.includes('[execute-generate-shots] continuity check starting')
)

// 2. Single enrich pass after model output
const generateShotsAi = read('server/utils/generate-shots-ai.ts')
assert(
  'prompts: generate-shots-ai does not call enrichGeneratedShotsForContinuity',
  !generateShotsAi.includes('enrichGeneratedShotsForContinuity')
)

const audioPolicy = read('lib/video-generation-audio-policy.ts')
const unifiedPrompt = read('lib/unified-shot-prompt.ts')
assert(
  'prompts: canonical shot video assembly in unified-shot-prompt',
  unifiedPrompt.includes('export function resolveShotVideoGenerationPrompt')
)
assert(
  'prompts: user dialogue/ambient helper renamed',
  audioPolicy.includes('export function resolveVideoGenerationUserPrompt')
)
assert(
  'prompts: no duplicate export in audio-policy',
  !audioPolicy.includes('export const resolveVideoGenerationPrompt')
)

const videoTool = read('pages/tools/video-generation.vue')
assert(
  'prompts: video tool uses resolveVideoGenerationUserPrompt',
  videoTool.includes('resolveVideoGenerationUserPrompt')
)

// 3. Auth on generation endpoints
for (const file of [
  'server/api/generate/image.post.ts',
  'server/api/generate/video.post.ts',
  'server/api/generate-character.post.ts',
  'server/api/generate/video/status.get.ts'
]) {
  const src = read(file)
  assert(
    `auth: ${file} requires user session`,
    src.includes('getPocketBaseUserIdFromRequest')
  )
}

const videoRegistry = read('server/utils/video-generation-job-registry.ts')
const videoPost = read('server/api/generate/video.post.ts')
assert(
  'auth: video job registry stores userId',
  videoRegistry.includes('userId: string') && videoPost.includes('userId')
)

// 4. Scene mapper exists
assert(
  'scene: CreativeScene type defined',
  read('types/creative-scene.ts').includes('export interface CreativeScene')
)
assert(
  'scene: pbRecordToCreativeScene mapper',
  read('server/utils/creative-scene-map.ts').includes('export function pbRecordToCreativeScene')
)
assert(
  'scene: scenes API uses mapper',
  read('server/api/projects/[id]/scenes.get.ts').includes('pbRecordToCreativeScene')
)

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

console.log(`\nAll ${checks.length} P0 remediation checks passed.`)
