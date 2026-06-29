#!/usr/bin/env node
/**
 * Verify prompt assembly (PASS 2).
 * Run: node scripts/verify-prompt-assembly.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => readFileSync(join(root, rel), 'utf8')

const checks = []
const assert = (name, ok) => checks.push({ name, ok })

const unified = read('lib/unified-shot-prompt.ts')
const audio = read('lib/video-generation-audio-policy.ts')
const enrich = read('server/utils/enrich-generated-shots.ts')
const generateAi = read('server/utils/generate-shots-ai.ts')
const execute = read('server/utils/execute-generate-shots.ts')
const continuity = read('lib/shot-character-continuity.ts')
const videoTool = read('pages/tools/video-generation.vue')

assert('canonical resolveShotVideoGenerationPrompt in unified-shot-prompt', unified.includes('export function resolveShotVideoGenerationPrompt'))
assert('unified keeps deprecated resolveVideoGenerationPrompt alias', unified.includes('export const resolveVideoGenerationPrompt = resolveShotVideoGenerationPrompt'))
assert('audio-policy has resolveVideoGenerationUserPrompt only', audio.includes('export function resolveVideoGenerationUserPrompt'))
assert('audio-policy has no resolveVideoGenerationPrompt export', !audio.includes('export const resolveVideoGenerationPrompt'))
assert('shot-character-continuity uses resolveShotVideoGenerationPrompt', continuity.includes('resolveShotVideoGenerationPrompt'))
assert('applyUnifiedPromptsToShot skips already-unified prompts', unified.includes('promptLooksUnified(shotCanon.imagePrompt)'))
assert('single enrich entry: not in generate-shots-ai', !generateAi.includes('enrichGeneratedShotsForContinuity'))
assert('single enrich entry: in execute-generate-shots after continuity', execute.includes('enrichGeneratedShotsForContinuity') && execute.indexOf('checkShotsContinuity') < execute.indexOf('enrichGeneratedShotsForContinuity'))
assert('enrich delegates to applyUnifiedPromptsToShot', enrich.includes('applyUnifiedPromptsToShot'))
assert('video tool uses resolveVideoGenerationUserPrompt', videoTool.includes('resolveVideoGenerationUserPrompt'))
assert('no duplicate buildSharedProductionBlocks', !continuity.includes('buildSharedProductionBlocks'))

let failed = 0
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}`)
  if (!c.ok) failed++
}
if (failed) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} prompt assembly checks passed.`)
