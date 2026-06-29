#!/usr/bin/env node
/**
 * PASS 28–29 — Timeline cloud persistence + append handoff verification.
 * Run: node scripts/verify-timeline-persistence.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read (rel) {
  return readFileSync(join(root, rel), 'utf8')
}

function exists (rel) {
  return existsSync(join(root, rel))
}

const checks = []

function assert (name, ok) {
  checks.push({ name, ok })
}

const types = read('types/project-timeline.ts')
assert('ProjectTimeline type defined', types.includes('export interface ProjectTimeline'))
assert('ProjectTimelineDocument defined', types.includes('export interface ProjectTimelineDocument'))
assert('ProjectTimelineClip alias', types.includes('export type ProjectTimelineClip'))

const normalize = read('lib/project-timeline-normalize.ts')
assert('normalizeProjectTimelineDocument exported', normalize.includes('export function normalizeProjectTimelineDocument'))
assert('stripPlaybackTokenFromUrl exported', normalize.includes('export function stripPlaybackTokenFromUrl'))
assert('timelineDocumentStats exported', normalize.includes('export function timelineDocumentStats'))

const mapper = read('server/utils/project-timeline-map.ts')
assert('pbRecordToProjectTimeline exported', mapper.includes('export function pbRecordToProjectTimeline'))
assert('projectTimelineDocumentToPbFields exported', mapper.includes('export function projectTimelineDocumentToPbFields'))
assert('projectIdOnTimelineRow exported', mapper.includes('export function projectIdOnTimelineRow'))

const getRoute = read('server/api/projects/[id]/timeline.get.ts')
assert('GET timeline route exists', exists('server/api/projects/[id]/timeline.get.ts'))
assert('GET requires project owner', getRoute.includes('requireProjectOwner'))
assert('GET uses timeline mapper', getRoute.includes('project-timeline-map'))

const putRoute = read('server/api/projects/[id]/timeline.put.ts')
assert('PUT timeline route exists', exists('server/api/projects/[id]/timeline.put.ts'))
assert('PUT requires project owner', putRoute.includes('requireProjectOwner'))
assert('PUT validates document', putRoute.includes('normalizeProjectTimelineDocument'))
assert('PUT revision conflict 409', putRoute.includes('statusCode: 409'))
assert('PUT requires baseRevision when row exists', putRoute.includes('baseRevision == null'))

const setup = read('scripts/setup-collections.js')
assert('setup provisions project_timelines', setup.includes("name: 'project_timelines'"))
assert('project_timelines has timeline_json', setup.includes("name: 'timeline_json'"))
assert('project_timelines has owned_by', setup.includes('project_timelines') && setup.includes('owned_by'))

const storage = read('lib/timeline-editor/storage.ts')
assert('localStorage key prefix preserved', storage.includes('aie_timeline_editor_v2_'))
assert('saveTimelineToStorage preserved', storage.includes('export function saveTimelineToStorage'))
assert('loadTimelineFromStorage preserved', storage.includes('export function loadTimelineFromStorage'))

const editorState = read('composables/useTimelineEditorState.ts')
assert('editor still persists to localStorage', editorState.includes('saveTimelineToStorage'))
assert('onAfterPersist hook', editorState.includes('onAfterPersist'))

const composable = read('composables/useProjectTimeline.ts')
assert('useProjectTimeline composable', composable.includes('export function useProjectTimeline'))
assert('cloud fetch', composable.includes('fetchCloud'))
assert('import local to cloud', composable.includes('importLocalToCloud'))

const timelinePage = read('pages/projects/[projectId]/timeline.vue')
assert('timeline page cloud status UI', timelinePage.includes('TIMELINE_SYNC_STATUS_LABELS') && timelinePage.includes('syncStatus'))
assert('timeline page import prompt', timelinePage.includes('Save local timeline to cloud'))
assert('timeline page save error display', timelinePage.includes('saveError'))

const design = read('docs/TimelinePersistenceDesign.md')
assert('design doc PASS 28 UX audit', design.includes('PASS 28') && design.includes('Timeline UX audit'))
assert('design doc implementation note', design.includes('PASS 28 Implementation'))

const checkpoint = read('docs/TodayCheckpoint.md')
assert('checkpoint mentions PASS 28', checkpoint.includes('PASS 28'))

const panel = read('components/project/ProductionBiblePanel.vue')
assert('no timeline writes in bible panel', !panel.includes('project_timelines') && !panel.includes('/timeline'))

const putSrc = putRoute
assert('PUT does not write bible', !putSrc.includes('bible_entities') && !putSrc.includes('bible_facts'))

// PASS 29 — cloud append handoff
const clipsPost = read('server/api/projects/[id]/timeline/clips.post.ts')
assert('POST timeline clips route exists', exists('server/api/projects/[id]/timeline/clips.post.ts'))
assert('POST clips requires project owner', clipsPost.includes('requireProjectOwner'))
assert('POST clips uses append utility', clipsPost.includes('appendClipsToProjectTimeline'))

const appendUtil = read('server/utils/append-project-timeline-clips.ts')
assert('append utility exports appendClipsToProjectTimeline', appendUtil.includes('export async function appendClipsToProjectTimeline'))
assert('append preserves assetId field', appendUtil.includes('assetId'))

const appendDoc = read('lib/timeline-editor/append-to-document.ts')
assert('append-to-document withAssetId', appendDoc.includes('assetId'))

const videoAppend = read('lib/append-project-timeline-video.ts')
assert('video append is async', videoAppend.includes('export async function appendVideoToProjectTimeline'))
assert('video append calls cloud', videoAppend.includes('appendClipsToCloudTimeline'))
assert('video append local backup', videoAppend.includes('appendVideoToLocalStorage'))
assert('video append assetId on input', videoAppend.includes('assetId'))

const audioAppend = read('lib/append-project-timeline-audio.ts')
assert('audio append is async', audioAppend.includes('export async function appendAudioToProjectTimeline'))
assert('audio append calls cloud', audioAppend.includes('appendClipsToCloudTimeline'))
assert('audio append local backup', audioAppend.includes('appendAudioToLocalStorage'))

const feedback = read('lib/timeline-append-feedback.ts')
assert('timeline append toast cloud message', feedback.includes('Added to cloud timeline'))
assert('timeline append toast local only', feedback.includes('Added locally only'))
assert('timeline append toast unavailable', feedback.includes('Cloud timeline unavailable'))

assert('asset hub passes assetId', read('components/assets/AssetKindHub.vue').includes('assetId: a.id'))
assert('music hub passes assetId', read('components/assets/MusicAssetHub.vue').includes('assetId: a.id'))
assert('video generation passes assetId', read('pages/tools/video-generation.vue').includes('assetId: kept.assetId'))

const clipsPostSrc = clipsPost
assert('POST clips does not write bible', !clipsPostSrc.includes('bible_entities') && !clipsPostSrc.includes('bible_facts'))

assert('design doc PASS 29 note', design.includes('PASS 29'))
assert('checkpoint mentions PASS 29', checkpoint.includes('PASS 29'))

// PASS 30 — missing media UX
const reliability = read('lib/timeline-clip-media-reliability.ts')
assert('classifyTimelineClipMedia exported', reliability.includes('export function classifyTimelineClipMedia'))
assert('isBlobTimelineUrl exported', reliability.includes('export function isBlobTimelineUrl'))
assert('resolveTimelineClipPlaybackSrc exported', reliability.includes('export function resolveTimelineClipPlaybackSrc'))
assert('cloud asset label', reliability.includes('Cloud asset'))
assert('local blob label', reliability.includes('Local blob'))
assert('missing media label', reliability.includes('Missing media'))

const clipUi = read('components/editor/TimelineClip.vue')
assert('clip media badge in UI', clipUi.includes('mediaLabel'))
assert('clip recoverable badge class', clipUi.includes('recoverable'))

const editorUi = read('components/editor/TimelineEditor.vue')
assert('repair clip button', editorUi.includes('Repair clip media from asset'))
assert('media reliability summary', editorUi.includes('Clip media reliability'))
assert('useTimelineClipMediaReliability', editorUi.includes('useTimelineClipMediaReliability'))

assert('editor repairClipMedia', read('composables/useTimelineEditorState.ts').includes('repairClipMedia'))
assert('timeline clip assetId type', read('types/timeline-editor.ts').includes('assetId?: string'))

assert('design doc PASS 30 note', design.includes('PASS 30'))
assert('checkpoint mentions PASS 30', checkpoint.includes('PASS 30'))

// PASS 31 — stability checkpoint
assert('cancelPendingCloudSave exported', composable.includes('cancelPendingCloudSave'))
assert('applyCloudTimeline helper', composable.includes('applyCloudTimeline'))
assert('409 triggers fetchCloud resync', composable.includes('await fetchCloud()'))
assert('clip push cancels pending cloud save', timelinePage.includes('cancelPendingCloudSave'))
assert('clip push refetches cloud revision', timelinePage.includes('timelineClipPushed'))
assert('repair scoped to linked clips only', editorState.includes('linked.has(c.id)') && !editorState.includes('c.assetId === assetId'))
assert('design doc PASS 31 stability', design.includes('PASS 31'))
assert('checkpoint mentions PASS 31', checkpoint.includes('PASS 31'))

// PASS 32 — conflict merge UX
const syncStatus = read('lib/timeline-sync-status.ts')
assert('sync status labels', syncStatus.includes('Synced') && syncStatus.includes('Conflict'))
assert('local changes pending label', syncStatus.includes('Local changes pending'))

assert('conflictActive in persistence', composable.includes('conflictActive'))
assert('reloadCloudIntoEditor', composable.includes('reloadCloudIntoEditor'))
assert('keepLocalAfterConflict', composable.includes('keepLocalAfterConflict'))
assert('overwriteCloudWithDocument', composable.includes('overwriteCloudWithDocument'))
assert('409 sets conflict not auto message', composable.includes('setConflict()'))

const backup = read('lib/timeline-editor/local-backup.ts')
assert('snapshotTimelineLocalBackup', backup.includes('snapshotTimelineLocalBackup'))

assert('conflict banner UI', timelinePage.includes('Cloud timeline changed while you were editing'))
assert('reload cloud action', timelinePage.includes('Reload cloud timeline'))
assert('keep local action', timelinePage.includes('Keep my local version'))
assert('overwrite cloud action', timelinePage.includes('Save my version over cloud'))
assert('local changes not synced message', timelinePage.includes('Local changes not synced'))

assert('design doc PASS 32', design.includes('PASS 32'))
assert('checkpoint mentions PASS 32', checkpoint.includes('PASS 32'))

// PASS 33 — offline cloud save queue
const queueHelper = read('lib/timeline-editor/cloud-save-queue.ts')
const saveError = read('lib/timeline-cloud-save-error.ts')

assert('queue helper enqueueTimelineCloudSave', queueHelper.includes('enqueueTimelineCloudSave'))
assert('queue record fields', queueHelper.includes('attemptCount') && queueHelper.includes('queuedAt'))
assert('isTimelineCloudSaveQueueableError', saveError.includes('isTimelineCloudSaveQueueableError'))
assert('auth errors not queueable', saveError.includes('isApiFetchAuthError') && saveError.includes('return false'))
assert('409 not queueable', saveError.includes('isApiFetchConflictError'))
assert('network failures queueable', saveError.includes('isLikelyNetworkOrOfflineError'))
assert('server 5xx queueable', saveError.includes('isApiFetchServerUnavailableError'))
const saveCloudFn = composable.slice(composable.indexOf('async function saveCloud'))
assert('409 handled before queue in saveCloud', saveCloudFn.includes('statusCode === 409') && saveCloudFn.indexOf('statusCode === 409') < saveCloudFn.indexOf('isTimelineCloudSaveQueueableError'))
assert('flushCloudSaveQueue exported', composable.includes('flushCloudSaveQueue'))
assert('retryCloudSync exported', composable.includes('retryCloudSync'))
assert('clearQueuedCloudSave exported', composable.includes('clearQueuedCloudSave'))
assert('reconnect online listener', composable.includes("addEventListener('online'"))
assert('queued sync status label', syncStatus.includes('Queued for cloud sync'))
assert('retry cloud sync UI', timelinePage.includes('Retry cloud sync'))
assert('clear queued save UI', timelinePage.includes('Clear queued save'))
assert('queued for cloud sync message', timelinePage.includes('Queued for cloud sync'))
assert('design doc PASS 33', design.includes('PASS 33'))
assert('checkpoint mentions PASS 33', checkpoint.includes('PASS 33'))

let failed = 0
for (const { name, ok } of checks) {
  if (!ok) {
    console.error(`✗ ${name}`)
    failed++
  } else {
    console.log(`✓ ${name}`)
  }
}

console.log(`\n${checks.length} checks, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
