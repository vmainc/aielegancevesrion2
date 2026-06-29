#!/usr/bin/env node
/**
 * PASS 4 — Canonical Scene type / mapper verification.
 * Run: node scripts/verify-scene-type.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read (rel) {
  return readFileSync(join(root, rel), 'utf8')
}

const checks = []

function assert (name, ok) {
  checks.push({ name, ok })
}

const sceneType = read('types/creative-scene.ts')
assert('canonical CreativeScene includes id', sceneType.includes('id: string'))
assert('canonical CreativeScene includes ownerId', sceneType.includes('ownerId: string'))
assert('canonical CreativeScene includes projectId', sceneType.includes('projectId: string'))
assert('canonical CreativeScene includes sortOrder', sceneType.includes('sortOrder: number'))
assert('canonical CreativeScene includes screenplay text fields', sceneType.includes('heading: string') && sceneType.includes('summary: string') && sceneType.includes('body: string'))
assert('canonical CreativeScene includes timestamps', sceneType.includes('created: string') && sceneType.includes('updated: string'))
assert('canonical list projection defined', sceneType.includes('CreativeSceneListItem') && sceneType.includes('bodyLength: number'))

const mapper = read('server/utils/creative-scene-map.ts')
assert('mapper exports pbRecordToCreativeScene', mapper.includes('export function pbRecordToCreativeScene'))
assert('mapper maps owner/project relations', mapper.includes('ownerId: relId') && mapper.includes('projectId: relId'))
assert('mapper normalizes scene input for PocketBase', mapper.includes('export function normalizeCreativeSceneForPb'))
assert('mapper exposes collection limits', mapper.includes('CREATIVE_SCENE_HEADING_MAX') && mapper.includes('CREATIVE_SCENE_BODY_MAX'))
assert('mapper exposes list projection', mapper.includes('export function creativeSceneToListItem'))
assert('mapper owns next sort order', mapper.includes('export async function nextCreativeSceneSortOrder'))

for (const file of [
  'server/api/projects/[id]/scenes.get.ts',
  'server/api/projects/[id]/scenes.post.ts',
  'server/api/projects/[id]/scenes/[sceneId].patch.ts',
  'server/api/storyboard-builder/scenes.post.ts'
]) {
  const src = read(file)
  assert(`${file} uses canonical scene mapper`, src.includes('creative-scene-map'))
}

for (const file of [
  'server/api/projects/[id]/scenes/[sceneId].delete.ts',
  'server/api/projects/[id]/scenes/[sceneId]/shots.get.ts',
  'server/api/projects/[id]/scenes/[sceneId]/shots.post.ts',
  'server/api/projects/[id]/scenes/[sceneId]/shots/reorder.patch.ts',
  'server/utils/project-video-panel-prefill.ts'
]) {
  const src = read(file)
  assert(`${file} uses canonical project relation mapping`, src.includes('projectIdOnSceneRow'))
}

assert('script import uses canonical scene normalization', read('server/utils/import-script-core.ts').includes("normalizeCreativeSceneForPb } from '~/server/utils/creative-scene-map'"))
assert('timeline grouping aligns with canonical scene list item', read('lib/project-scene-groups.ts').includes('CreativeSceneListItem'))

for (const file of [
  'pages/projects/[projectId]/scenes.vue',
  'pages/projects/[projectId]/storyboard.vue',
  'pages/projects/[projectId]/video.vue',
  'pages/projects/[projectId]/home.vue',
  'pages/tools/storyboard-builder.vue',
  'composables/useProjectScenesHydration.ts'
]) {
  const src = read(file)
  assert(`${file} uses CreativeSceneListItem`, src.includes('CreativeSceneListItem'))
  assert(`${file} has no local SceneRow alias`, !src.includes('type SceneRow') && !src.includes('type SceneListRow'))
}

assert('root tsconfig extends nuxt generated config', read('tsconfig.json').includes('.nuxt/tsconfig.json'))

let failed = 0
for (const c of checks) {
  const mark = c.ok ? '✓' : '✗'
  console.log(`${mark} ${c.name}`)
  if (!c.ok) failed++
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}

console.log(`\nAll ${checks.length} scene type checks passed.`)
