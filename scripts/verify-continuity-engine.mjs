#!/usr/bin/env node
/**
 * Verify Continuity Engine wiring (PASS 1).
 * Run: node scripts/verify-continuity-engine.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => readFileSync(join(root, rel), 'utf8')

const checks = []
const assert = (name, ok) => checks.push({ name, ok })

const execute = read('server/utils/execute-generate-shots.ts')
const continuity = read('server/utils/continuity-check-ai.ts')
const persist = read('server/utils/persist-continuity-results.ts')
const runJob = read('server/utils/run-generate-shots-job.ts')
const analyze = read('server/utils/analyze-project-scene.ts')
const importSeed = read('server/utils/import-storyboard-seed.ts')

assert('checkShotsContinuity defined', continuity.includes('export async function checkShotsContinuity'))
assert('execute-generate-shots calls checkShotsContinuity', execute.includes('await checkShotsContinuity('))
assert('execute-generate-shots persists continuity', execute.includes('persistContinuityCheckOnProject'))
assert('no hardcoded clean continuity result', !execute.includes('issueCount: 0') && !execute.includes('memoryUpdated: false'))
assert('continuity logging in execute-generate-shots', execute.includes('[execute-generate-shots] continuity check starting'))
assert('continuity logging in continuity-check-ai', continuity.includes('[continuity-check-ai] running'))
assert('job runner logs continuity', runJob.includes('continuityIssueCount'))
assert('analyze scene returns continuity', analyze.includes('continuity: shotResult.continuity'))
assert('import path documents skip', importSeed.includes('continuity check skipped (import speed path)'))
assert('persist writes continuity_last_issues', persist.includes('continuity_last_issues'))
assert('continuity check returns status field', continuity.includes("status: 'ran'") || continuity.includes('status: ContinuityCheckStatus'))
assert('fail paths do not fake clean pass', !continuity.includes("issues: [], shots: input.shots, memoryAppend: '' }") || continuity.includes('failResult'))
assert('persist handles non-ran status', persist.includes("status === 'ran'"))
assert('shared continuity summary type', read('lib/continuity-check-result.ts').includes('ContinuityCheckStatus'))
assert('scenes UI shows continuity panel', read('pages/projects/[projectId]/scenes.vue').includes('Continuity check'))

let failed = 0
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}`)
  if (!c.ok) failed++
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} continuity engine checks passed.`)
