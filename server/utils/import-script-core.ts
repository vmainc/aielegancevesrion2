import { createError } from 'h3'
import type PocketBase from 'pocketbase'
import type { ParsedScript } from '~/server/utils/parse-script-fdx'
import { parseFdxXml } from '~/server/utils/parse-script-fdx'
import {
  filterLikelyCharacterNames,
  heuristicCharacterNamesFromScenes,
  isExcludedScreenplayCharacterLabel,
  parsePlainScriptText
} from '~/server/utils/parse-script-txt'
import { extractTextFromPdfBuffer } from '~/server/utils/extract-pdf-text'
import {
  enrichScriptWithAi,
  enrichmentToProjectFields,
  inferThreeActThemeBreakdown,
  inferDirectorFromImportedScript,
  inferCharactersWithScreenShareFromScript,
  inferScenesFromScriptWithClaude,
  buildCharacterRowsFromFallback,
  normalizeCharacterShares,
  type CharacterWithShare
} from '~/server/utils/script-import-ai'
import {
  IMPORT_STORYBOARD_MAX_SCENES,
  seedStoryboardsAfterScriptImport,
  type StoryboardSeedResult
} from '~/server/utils/import-storyboard-seed'
import {
  formatDirectorForAiPrompt,
  parseDirectorField,
  pbRecordToCreativeProject
} from '~/server/utils/creative-project-map'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import type { CreativeProject } from '~/types/creative-project'

const ASPECT = new Set(['16:9', '9:16', '1:1'])
const GOALS = new Set(['film', 'social', 'commercial', 'other'])

export type AspectRatio = '16:9' | '9:16' | '1:1'
export type ProjectGoal = 'film' | 'social' | 'commercial' | 'other'

export interface ScriptImportParams {
  userId: string
  pb: PocketBase
  fileBuf: Buffer
  filename: string
  aspectRatio: AspectRatio
  goal: ProjectGoal
  existingProjectId?: string
  newProjectName?: string
}

function normalizeAspect (v: string): AspectRatio {
  return ASPECT.has(v) ? (v as AspectRatio) : '16:9'
}

function normalizeGoal (v: string): ProjectGoal {
  return GOALS.has(v) ? (v as ProjectGoal) : 'film'
}

/** Align with `server/api/projects/[id]/assets/upload.post.ts` / PocketBase `project_assets.file` maxSize */
const PROJECT_ASSET_FILE_MAX_BYTES = 52_428_800

/** Must match `scripts/setup-collections.js` creative_scenes field max lengths. */
const PB_SCENE_HEADING_MAX = 2000
const PB_SCENE_SUMMARY_MAX = 5000
const PB_SCENE_BODY_MAX = 150_000

/**
 * PocketBase requires non-empty `heading`; parser/Claude rows sometimes omit it.
 * Clamp strings to collection max lengths so validation never fails on size.
 */
function normalizeCreativeSceneForPb (
  index: number,
  row: { heading: string; summary: string; body: string }
): { heading: string; summary: string; body: string } {
  let heading = (row.heading || '').trim().slice(0, PB_SCENE_HEADING_MAX)
  if (!heading) heading = `Scene ${index + 1}`
  let summary = (row.summary || '').trim().slice(0, PB_SCENE_SUMMARY_MAX)
  if (!summary) summary = heading.slice(0, Math.min(500, heading.length))
  let body = (row.body || '').trim().slice(0, PB_SCENE_BODY_MAX)
  if (!body) body = summary.slice(0, PB_SCENE_BODY_MAX)
  return { heading, summary, body }
}

export type ScriptAssetAttachResult =
  | { ok: true; id: string }
  | { ok: false; message: string }

function shouldRetryProjectAssetCreateWithoutOptionalFields (msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('sort_order') ||
    m.includes('metadata') ||
    m.includes('validation_unknown_keys') ||
    m.includes('unknown field') ||
    m.includes('field not found')
  )
}

async function createProjectScriptAssetRow (params: {
  pb: PocketBase
  userId: string
  projectId: string
  title: string
  notes: string
  metadata: Record<string, unknown>
  safeFilename: string
  fileBuf: Buffer
  logPrefix: string
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const {
    pb,
    userId,
    projectId,
    title,
    notes,
    metadata,
    safeFilename,
    fileBuf,
    logPrefix
  } = params

  const appendFile = (fd: FormData) => {
    const uint8 = fileBuf instanceof Uint8Array ? fileBuf : new Uint8Array(fileBuf)
    const blob = new Blob([uint8])
    fd.append('file', blob, safeFilename)
  }

  const withOptional = new FormData()
  withOptional.append('owned_by', userId)
  withOptional.append('project', projectId)
  withOptional.append('kind', 'script')
  withOptional.append('title', title.slice(0, 500))
  withOptional.append('notes', notes.slice(0, 8000))
  withOptional.append('sort_order', '0')
  withOptional.append('metadata', JSON.stringify(metadata))
  appendFile(withOptional)

  try {
    const created = await pb.collection('project_assets').create(withOptional)
    const id = String((created as { id?: string }).id || '').trim()
    if (!id) return { ok: false, message: 'project_assets row created without an id.' }
    return { ok: true, id }
  } catch (assetErr: unknown) {
    const firstMsg = formatPocketBaseRecordError(assetErr)
    if (!shouldRetryProjectAssetCreateWithoutOptionalFields(firstMsg)) {
      console.warn(`[import-script] ${logPrefix} project_assets create failed:`, firstMsg)
      return {
        ok: false,
        message: firstMsg || 'Could not save the script file to project assets.'
      }
    }

    // Legacy production schemas may not include optional fields yet.
    const legacySafe = new FormData()
    legacySafe.append('owned_by', userId)
    legacySafe.append('project', projectId)
    legacySafe.append('kind', 'script')
    legacySafe.append('title', title.slice(0, 500))
    legacySafe.append('notes', notes.slice(0, 8000))
    appendFile(legacySafe)

    try {
      const created = await pb.collection('project_assets').create(legacySafe)
      const id = String((created as { id?: string }).id || '').trim()
      if (!id) return { ok: false, message: 'project_assets row created without an id.' }
      console.warn(
        `[import-script] ${logPrefix} project_assets created via legacy fallback (missing optional fields: metadata/sort_order).`
      )
      return { ok: true, id }
    } catch (legacyErr: unknown) {
      const secondMsg = formatPocketBaseRecordError(legacyErr)
      console.warn(`[import-script] ${logPrefix} project_assets fallback failed:`, secondMsg)
      return {
        ok: false,
        message: secondMsg || firstMsg || 'Could not save the script file to project assets.'
      }
    }
  }
}

async function deleteProjectScenesOnly (pb: PocketBase, projectId: string) {
  const scenes = await pb.collection('creative_scenes').getFullList({
    filter: `project = "${projectId}"`,
    batch: 200
  })
  for (const s of scenes) {
    await pb.collection('creative_scenes').delete(s.id)
  }
}

async function deleteProjectScenesAndCharacters (pb: PocketBase, projectId: string) {
  await deleteProjectScenesOnly(pb, projectId)
  const chars = await pb.collection('creative_characters').getFullList({
    filter: `project = "${projectId}"`,
    batch: 200
  })
  for (const c of chars) {
    await pb.collection('creative_characters').delete(c.id)
  }
}

function isWorkflowScriptImportRow (row: { id: string; notes?: string; metadata?: unknown }): boolean {
  const notes = String(row.notes || '')
  const meta = row.metadata
  let source = ''
  if (meta && typeof meta === 'object' && meta !== null && 'source' in meta) {
    source = String((meta as { source?: string }).source || '')
  }
  return source === 'script_import' || notes.includes('Imported script for') || notes.includes('Screenplay file saved')
}

/**
 * Remove workflow script-import rows. If exceptId is set, keep that record (e.g. re-analyze same upload).
 */
async function deleteWorkflowScriptImportAssetsExcept (
  pb: PocketBase,
  userId: string,
  projectId: string,
  exceptId: string | null
) {
  try {
    const list = await pb.collection('project_assets').getFullList({
      filter: `project = "${projectId}" && owned_by = "${userId}" && kind = "script"`,
      batch: 200
    })
    for (const row of list) {
      if (exceptId && row.id === exceptId) continue
      if (!isWorkflowScriptImportRow(row as { id: string; notes?: string; metadata?: unknown })) continue
      await pb.collection('project_assets').delete(row.id)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[import-script] could not prune script assets:', msg)
  }
}

function scriptExtensionOk (filename: string): boolean {
  const lower = filename.toLowerCase()
  return lower.endsWith('.fdx') || lower.endsWith('.txt') || lower.endsWith('.pdf')
}

/** Strict parse for analysis / legacy full import. */
export async function parseScriptBufferToParsed (fileBuf: Buffer, filename: string): Promise<ParsedScript> {
  if (!scriptExtensionOk(filename)) {
    throw createError({ statusCode: 400, message: 'Only .fdx, .txt, and .pdf files are supported' })
  }
  const lower = filename.toLowerCase()
  const isFdx = lower.endsWith('.fdx')
  const isTxt = lower.endsWith('.txt')
  const isPdf = lower.endsWith('.pdf')
  let parsed: ParsedScript
  try {
    if (isPdf) {
      const text = await extractTextFromPdfBuffer(fileBuf)
      parsed = parsePlainScriptText(text)
    } else {
      const xmlOrText = fileBuf.toString('utf8')
      parsed = isFdx ? parseFdxXml(xmlOrText) : parsePlainScriptText(xmlOrText)
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Could not parse script'
    throw createError({ statusCode: 400, message: msg })
  }
  if (!parsed.scenes.length) {
    let body = ''
    try {
      if (isPdf) {
        body = await extractTextFromPdfBuffer(fileBuf)
      } else {
        body = fileBuf.toString('utf8')
      }
    } catch {
      body = ''
    }
    body = body.trim()
    if (!body) {
      throw createError({ statusCode: 400, message: 'No readable text or scenes found in this file.' })
    }
    return {
      scenes: [{ heading: 'FULL SCRIPT', body: body.slice(0, 150_000) }],
      characterNames: [...parsed.characterNames]
    }
  }
  return parsed
}

export async function downloadProjectAssetFileBuffer (pb: PocketBase, record: Record<string, unknown>): Promise<Buffer> {
  const fname = record.file
  if (typeof fname !== 'string' || !fname.length) {
    throw createError({ statusCode: 400, message: 'Asset has no file attached' })
  }
  const url = pb.files.getURL(record as never, fname)
  const headers: Record<string, string> = {}
  const token = pb.authStore.token
  if (token) {
    headers.Authorization = token
  }
  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw createError({
      statusCode: 502,
      message: `Could not download screenplay file from storage (${res.status})`
    })
  }
  return Buffer.from(await res.arrayBuffer())
}

async function attachPendingScriptAsset (params: {
  pb: PocketBase
  userId: string
  projectId: string
  filename: string
  fileBuf: Buffer
  noteTitle: string
  previewSceneCount: number
  parseWarning?: string
}): Promise<ScriptAssetAttachResult> {
  const { pb, userId, projectId, filename, fileBuf, noteTitle, previewSceneCount, parseWarning } = params
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'script.upload'
  const titleFromFile =
    safeFilename.replace(/\.(fdx|txt|pdf)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Screenplay'

  if (fileBuf.length > PROJECT_ASSET_FILE_MAX_BYTES) {
    return {
      ok: false,
      message: `Script file exceeds the ${Math.round(PROJECT_ASSET_FILE_MAX_BYTES / 1024 / 1024)}MB library limit.`
    }
  }

  const notes = parseWarning
    ? `Screenplay file saved for “${noteTitle}”. Run analysis to extract scenes, characters, and treatment. (${parseWarning})`
    : `Screenplay file saved for “${noteTitle}”. ${previewSceneCount} scene block(s) in a quick parse — run analysis to generate synopsis, treatment, scenes, and characters.`

  return createProjectScriptAssetRow({
    pb,
    userId,
    projectId,
    title: titleFromFile,
    notes,
    metadata: {
      source: 'script_import',
      analysis_status: 'pending',
      preview_scene_count: previewSceneCount,
      original_filename: filename.slice(0, 500),
      ...(parseWarning ? { parse_warning: parseWarning.slice(0, 500) } : {})
    },
    safeFilename,
    fileBuf,
    logPrefix: 'pending'
  })
}

async function attachScriptAsset (params: {
  pb: PocketBase
  userId: string
  projectId: string
  filename: string
  fileBuf: Buffer
  noteTitle: string
  sceneCount: number
}): Promise<ScriptAssetAttachResult> {
  const { pb, userId, projectId, filename, fileBuf, noteTitle, sceneCount } = params
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'script.upload'
  const titleFromFile =
    safeFilename.replace(/\.(fdx|txt|pdf)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported script'

  if (fileBuf.length > PROJECT_ASSET_FILE_MAX_BYTES) {
    return {
      ok: false,
      message: `Script file exceeds the ${Math.round(PROJECT_ASSET_FILE_MAX_BYTES / 1024 / 1024)}MB library limit. The project was updated; upload a smaller file under Assets or split the script.`
    }
  }

  return createProjectScriptAssetRow({
    pb,
    userId,
    projectId,
    title: titleFromFile,
    notes: `Imported script for “${noteTitle}”. ${sceneCount} scene(s).`,
    metadata: {
      source: 'script_import',
      analysis_status: 'complete',
      scene_count: sceneCount,
      original_filename: filename.slice(0, 500)
    },
    safeFilename,
    fileBuf,
    logPrefix: 'complete'
  })
}

async function updateScriptAssetAfterAnalysis (
  pb: PocketBase,
  assetId: string,
  params: { noteTitle: string; sceneCount: number; filename: string }
): Promise<ScriptAssetAttachResult> {
  try {
    const row = await pb.collection('project_assets').getOne(assetId)
    let meta: Record<string, unknown> = {}
    const raw = (row as { metadata?: unknown }).metadata
    if (typeof raw === 'string') {
      try {
        meta = JSON.parse(raw) as Record<string, unknown>
      } catch {
        meta = {}
      }
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      meta = { ...(raw as Record<string, unknown>) }
    }
    meta.source = 'script_import'
    meta.analysis_status = 'complete'
    meta.scene_count = params.sceneCount
    meta.original_filename = params.filename.slice(0, 500)
    await pb.collection('project_assets').update(assetId, {
      notes: `Imported script for “${params.noteTitle}”. ${params.sceneCount} scene(s).`.slice(0, 8000),
      metadata: JSON.stringify(meta)
    })
    return { ok: true, id: assetId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg || 'Could not update script asset metadata.' }
  }
}

async function updateScriptAssetAfterDirectorPass (
  pb: PocketBase,
  assetId: string,
  params: { noteTitle: string; previewSceneCount: number; filename: string }
): Promise<ScriptAssetAttachResult> {
  try {
    const row = await pb.collection('project_assets').getOne(assetId)
    let meta: Record<string, unknown> = {}
    const raw = (row as { metadata?: unknown }).metadata
    if (typeof raw === 'string') {
      try {
        meta = JSON.parse(raw) as Record<string, unknown>
      } catch {
        meta = {}
      }
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      meta = { ...(raw as Record<string, unknown>) }
    }
    meta.source = 'script_import'
    meta.analysis_status = 'director_ready'
    meta.preview_scene_count = params.previewSceneCount
    meta.original_filename = params.filename.slice(0, 500)
    await pb.collection('project_assets').update(assetId, {
      notes:
        `Screenplay for “${params.noteTitle}”. Director analysis complete (${params.previewSceneCount} scene block(s) in file). Generate cast on Characters, scene breakdown on Scenes, then panels on Storyboard.`.slice(
          0,
          8000
        ),
      metadata: JSON.stringify(meta)
    })
    return { ok: true, id: assetId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg || 'Could not update script asset metadata.' }
  }
}

/**
 * Save screenplay file to project assets only (no AI). User runs analyze separately.
 */
export async function uploadScriptFileToProject (input: {
  userId: string
  pb: PocketBase
  projectId: string
  fileBuf: Buffer
  filename: string
}): Promise<{
  project: CreativeProject
  scriptAsset: ScriptAssetAttachResult
  upload: { previewSceneCount: number; parseWarning?: string }
}> {
  const { userId, pb, projectId, fileBuf, filename } = input
  if (!scriptExtensionOk(filename)) {
    throw createError({ statusCode: 400, message: 'Only .fdx, .txt, and .pdf files are supported' })
  }
  if (!fileBuf?.length) {
    throw createError({ statusCode: 400, message: 'Missing script file' })
  }

  const existing = await pb.collection('creative_projects').getOne(projectId)
  const owner = pbRecordOwnerId(existing as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const stemTitle =
    filename.replace(/\.(fdx|txt|pdf)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported script'
  const noteTitle =
    typeof (existing as { name?: string }).name === 'string' && (existing as { name: string }).name.trim()
      ? (existing as { name: string }).name.trim()
      : stemTitle

  let previewSceneCount = 0
  let parseWarning: string | undefined
  try {
    const p = await parseScriptBufferToParsed(fileBuf, filename)
    previewSceneCount = p.scenes.length
  } catch (e: unknown) {
    previewSceneCount = 0
    const msg =
      e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
        ? (e as { message: string }).message
        : e instanceof Error
          ? e.message
          : 'Could not parse file yet — analysis will try again.'
    parseWarning = msg
  }

  await deleteWorkflowScriptImportAssetsExcept(pb, userId, projectId, null)
  const scriptAsset = await attachPendingScriptAsset({
    pb,
    userId,
    projectId,
    filename,
    fileBuf,
    noteTitle,
    previewSceneCount,
    parseWarning
  })

  await pb.collection('creative_projects').update(projectId, {
    source_filename: filename.slice(0, 500)
  })

  const full = await pb.collection('creative_projects').getOne(projectId)
  return {
    project: pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0]),
    scriptAsset,
    upload: { previewSceneCount, parseWarning }
  }
}

function workflowScreenplayFilenameFromAssetRow (assetRow: Record<string, unknown>): string {
  const meta = assetRow.metadata
  let origName = ''
  if (meta && typeof meta === 'object' && meta !== null && 'original_filename' in meta) {
    origName = String((meta as { original_filename?: string }).original_filename || '')
  } else if (typeof meta === 'string') {
    try {
      const o = JSON.parse(meta) as { original_filename?: string }
      origName = String(o.original_filename || '')
    } catch {
      origName = ''
    }
  }
  return origName || 'script.upload'
}

/**
 * Resolve the workflow screenplay asset for a project, download, and parse (shared by full import and cast enrich).
 */
export async function loadWorkflowScreenplayParsedForProject (input: {
  userId: string
  pb: PocketBase
  projectId: string
  assetId?: string
}): Promise<{
  parsed: ParsedScript
  filename: string
  fileBuf: Buffer
  assetId: string
}> {
  const { userId, pb, projectId } = input

  let assetRow: Record<string, unknown>

  if (input.assetId) {
    const one = await pb.collection('project_assets').getOne(input.assetId)
    if (pbRecordOwnerId(one as { owned_by?: unknown }) !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    if (String((one as { project?: string }).project) !== projectId) {
      throw createError({ statusCode: 400, message: 'Asset does not belong to this project' })
    }
    assetRow = one as Record<string, unknown>
  } else {
    const list = await listProjectAssetsForProject(pb, projectId, userId, { kind: 'script' })
    const found = list.find(r =>
      isWorkflowScriptImportRow(r as { id: string; notes?: string; metadata?: unknown })
    )
    if (!found) {
      throw createError({
        statusCode: 400,
        message: 'No screenplay file found for this project. Upload a script first.'
      })
    }
    assetRow = found as Record<string, unknown>
  }

  const filename = workflowScreenplayFilenameFromAssetRow(assetRow)
  const fileBuf = await downloadProjectAssetFileBuffer(pb, assetRow)
  const parsed = await parseScriptBufferToParsed(fileBuf, filename)

  return {
    parsed,
    filename,
    fileBuf,
    assetId: String((assetRow as { id: string }).id)
  }
}

/**
 * Synopsis, treatment, three-act notes, director bible — no scenes, characters, or storyboard.
 * Expects an existing cloud project and a workflow screenplay asset.
 */
export async function runDirectorOnlyFromParsed (input: {
  userId: string
  pb: PocketBase
  filename: string
  parsed: ParsedScript
  existingProjectId: string
  reuseAssetId: string
}): Promise<{ project: CreativeProject; scriptAsset: ScriptAssetAttachResult }> {
  const { userId, pb, filename, parsed, existingProjectId, reuseAssetId } = input

  const existing = await pb.collection('creative_projects').getOne(existingProjectId)
  const owner = pbRecordOwnerId(existing as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const sceneOutline = parsed.scenes
    .map((s, i) => `## Scene ${i}\nHeading: ${s.heading}\n---\n${s.body.slice(0, 2500)}`)
    .join('\n\n')

  const mergedCharacterNames = filterLikelyCharacterNames([
    ...parsed.characterNames,
    ...heuristicCharacterNamesFromScenes(parsed.scenes)
  ])

  const stemTitle =
    filename.replace(/\.(fdx|txt|pdf)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported script'
  const noteTitle =
    typeof (existing as { name?: string }).name === 'string' && (existing as { name: string }).name.trim()
      ? (existing as { name: string }).name.trim()
      : stemTitle

  const enrichment = await enrichScriptWithAi({
    projectName: noteTitle,
    sceneOutline,
    characterNames: mergedCharacterNames
  })

  const directorBible = await inferDirectorFromImportedScript({
    projectName: noteTitle,
    logline: enrichment.logline,
    onePageSynopsis: enrichment.onePageSynopsis,
    genre: enrichment.genre,
    tone: enrichment.tone,
    themes: enrichment.themes,
    sceneOutline,
    characterNames: mergedCharacterNames
  })

  const prose = enrichmentToProjectFields(enrichment)
  const threeAct = await inferThreeActThemeBreakdown({
    projectName: noteTitle,
    logline: enrichment.logline,
    onePageSynopsis: enrichment.onePageSynopsis,
    themeExploration: enrichment.themeExploration,
    sceneOutline
  })
  const treatmentWithActs = threeAct ? `${prose.treatment}\n\n${threeAct}` : prose.treatment
  const synopsisDb = prose.synopsis.slice(0, 20_000)
  const treatmentDb = treatmentWithActs.slice(0, 50_000)
  const directorFilled = Object.values(directorBible).some(
    v => typeof v === 'string' && v.trim().length > 0
  )

  const previewSceneCount = parsed.scenes.length
  const conceptNotes =
    `Imported from ${filename}. Director pass: synopsis, treatment, and comparable-film notes on Overview — refine the bible on the Director tab. ` +
    `Then generate cast (Characters), scene breakdown (Scenes), and optional panels (Storyboard). ${previewSceneCount} scene block(s) parsed from the file.`

  await pb.collection('creative_projects').update(existingProjectId, {
    synopsis: synopsisDb,
    treatment: treatmentDb,
    concept_notes: conceptNotes,
    genre: enrichment.genre,
    tone: enrichment.tone,
    themes: enrichment.themes.length ? enrichment.themes : null,
    source_filename: filename,
    ...(directorFilled ? { director: directorBible } : {})
  })

  const scriptAsset = await updateScriptAssetAfterDirectorPass(pb, reuseAssetId, {
    noteTitle,
    previewSceneCount,
    filename
  })

  const full = await pb.collection('creative_projects').getOne(existingProjectId)
  return {
    project: pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0]),
    scriptAsset
  }
}

/**
 * Run director-focused AI import from an existing project_assets screenplay row (no scenes / cast / storyboard).
 */
export async function analyzeScriptImportForProject (input: {
  userId: string
  pb: PocketBase
  projectId: string
  assetId?: string
}): Promise<{ project: CreativeProject; scriptAsset: ScriptAssetAttachResult }> {
  const { userId, pb, projectId } = input

  const projectRow = await pb.collection('creative_projects').getOne(projectId)
  const owner = pbRecordOwnerId(projectRow as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const { parsed, filename, assetId } = await loadWorkflowScreenplayParsedForProject({
    userId,
    pb,
    projectId,
    assetId: input.assetId
  })

  return runDirectorOnlyFromParsed({
    userId,
    pb,
    filename,
    parsed,
    existingProjectId: projectId,
    reuseAssetId: assetId
  })
}

/**
 * Replace all project scenes with a Claude breakdown (or parser fallback) using current Director notes + screenplay file.
 */
export async function generateScenesFromScriptForProject (input: {
  userId: string
  pb: PocketBase
  projectId: string
  assetId?: string
}): Promise<{
  project: CreativeProject
  scriptAsset: ScriptAssetAttachResult
  sceneCount: number
}> {
  const { userId, pb, projectId } = input

  const projectRow = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(projectRow as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const { parsed, filename, assetId } = await loadWorkflowScreenplayParsedForProject({
    userId,
    pb,
    projectId,
    assetId: input.assetId
  })

  const stemTitle =
    filename.replace(/\.(fdx|txt|pdf)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported script'
  const noteTitle =
    typeof (projectRow as { name?: string }).name === 'string' && (projectRow as { name: string }).name.trim()
      ? (projectRow as { name: string }).name.trim()
      : stemTitle

  const mergedCharacterNames = filterLikelyCharacterNames([
    ...parsed.characterNames,
    ...heuristicCharacterNamesFromScenes(parsed.scenes)
  ])
  const fullScriptText = parsed.scenes.map(s => `${s.heading}\n\n${s.body}`).join('\n\n---\n\n')
  const directorContext = formatDirectorForAiPrompt(
    parseDirectorField((projectRow as { director?: unknown }).director)
  )

  const genre = String((projectRow as { genre?: string }).genre || '')
  const tone = String((projectRow as { tone?: string }).tone || '')

  const claudeInferredScenes = await inferScenesFromScriptWithClaude({
    projectName: noteTitle,
    genre,
    tone,
    characterNames: mergedCharacterNames,
    fullScriptText,
    directorContext
  })

  const usedClaudeScenes = claudeInferredScenes.length > 0
  const sceneRowsForCreate: Array<{ heading: string; summary: string; body: string }> = usedClaudeScenes
    ? claudeInferredScenes.map(s => ({
        heading: s.heading,
        summary: s.summary,
        body: s.body
      }))
    : parsed.scenes.map(s => ({
        heading: s.heading.slice(0, 500),
        summary: (s.body.replace(/\s+/g, ' ').trim().slice(0, 280) || s.heading).slice(0, 2000),
        body: s.body.slice(0, 100_000)
      }))

  await deleteProjectScenesOnly(pb, projectId)

  for (let i = 0; i < sceneRowsForCreate.length; i++) {
    const s = normalizeCreativeSceneForPb(i, sceneRowsForCreate[i]!)
    try {
      await pb.collection('creative_scenes').create({
        owned_by: userId,
        project: projectId,
        sort_order: i + 1,
        heading: s.heading,
        summary: s.summary,
        body: s.body
      })
    } catch (e: unknown) {
      const detail = formatPocketBaseRecordError(e)
      console.error('[generate-scenes] creative_scenes.create failed:', detail, e)
      throw createError({
        statusCode: 400,
        message:
          detail && detail !== 'Failed to create record.'
            ? detail
            : `Could not save scene ${i + 1}. Check creative_scenes rules and field limits in PocketBase.`
      })
    }
  }

  await deleteWorkflowScriptImportAssetsExcept(pb, userId, projectId, assetId)

  const scriptAsset = await updateScriptAssetAfterAnalysis(pb, assetId, {
    noteTitle,
    sceneCount: sceneRowsForCreate.length,
    filename
  })

  const append = usedClaudeScenes
    ? ` Scenes: ${sceneRowsForCreate.length} generated (Claude breakdown).`
    : ` Scenes: ${sceneRowsForCreate.length} from screenplay parser.`
  const prevNotes = String((projectRow as { concept_notes?: string }).concept_notes || '')
  await pb.collection('creative_projects').update(projectId, {
    concept_notes: (prevNotes + append).slice(0, 50_000)
  })

  const full = await pb.collection('creative_projects').getOne(projectId)
  return {
    project: pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0]),
    scriptAsset,
    sceneCount: sceneRowsForCreate.length
  }
}

/**
 * Generate import-style shot lists for up to the first N scenes (uses current Director + character context).
 */
export async function seedStoryboardFromProjectScenes (input: {
  userId: string
  pb: PocketBase
  projectId: string
}): Promise<StoryboardSeedResult> {
  const { userId, pb, projectId } = input

  const projectRow = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(projectRow as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const sceneRows = await pb.collection('creative_scenes').getFullList({
    filter: `project = "${projectId}"`,
    sort: 'sort_order',
    batch: 400
  })
  if (!sceneRows.length) {
    throw createError({
      statusCode: 400,
      message: 'No scenes yet. Generate scenes from the Scenes tab first.'
    })
  }

  const charRows = await pb.collection('creative_characters').getFullList({
    filter: `project = "${projectId}"`,
    batch: 400
  })

  const scenes = sceneRows.map((r) => {
    const rec = r as Record<string, unknown>
    return {
      id: String(rec.id),
      heading: String(rec.heading || ''),
      summary: String(rec.summary || ''),
      body: String(rec.body || '')
    }
  })

  const characters = charRows.map((r) => {
    const rec = r as Record<string, unknown>
    return {
      name: String(rec.name || ''),
      role_description: String(rec.role_description || '')
    }
  })

  const sb = await seedStoryboardsAfterScriptImport({
    pb,
    userId,
    projectId,
    project: projectRow as Record<string, unknown>,
    scenes,
    characters
  })

  const noteParts: string[] = []
  if (sb.ok > 0) {
    noteParts.push(
      ` Storyboard seed: shot lists for ${sb.ok} scene(s) — open the Storyboard tab.`
    )
  }
  if (sb.capSkipped > 0) {
    noteParts.push(
      ` ${sb.capSkipped} scene(s) past the first ${IMPORT_STORYBOARD_MAX_SCENES} were not auto-boarded; use Generate Shots per scene.`
    )
  }
  if (sb.failed > 0) {
    noteParts.push(` ${sb.failed} scene(s) could not auto-generate shots — use Storyboard → Generate Shots.`)
  }
  if (noteParts.length) {
    const prev = String((projectRow as { concept_notes?: string }).concept_notes || '')
    await pb.collection('creative_projects').update(projectId, {
      concept_notes: (prev + noteParts.join('')).slice(0, 50_000)
    })
  }

  return sb
}

export async function runFullImportFromParsed (input: {
  userId: string
  pb: PocketBase
  fileBuf: Buffer
  filename: string
  parsed: ParsedScript
  aspectRatio: AspectRatio
  goal: ProjectGoal
  existingProjectId?: string
  newProjectName?: string
  reuseAssetId: string | null
}): Promise<{ project: CreativeProject; scriptAsset: ScriptAssetAttachResult }> {
  const {
    userId,
    pb,
    fileBuf,
    filename,
    parsed,
    aspectRatio,
    goal,
    existingProjectId,
    newProjectName,
    reuseAssetId
  } = input

  const sceneOutline = parsed.scenes
    .map((s, i) => `## Scene ${i}\nHeading: ${s.heading}\n---\n${s.body.slice(0, 2500)}`)
    .join('\n\n')

  const mergedCharacterNames = filterLikelyCharacterNames([
    ...parsed.characterNames,
    ...heuristicCharacterNamesFromScenes(parsed.scenes)
  ])

  const stemTitle =
    filename.replace(/\.(fdx|txt|pdf)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported script'

  let projectId: string
  let noteTitle: string

  if (existingProjectId) {
    const existing = await pb.collection('creative_projects').getOne(existingProjectId)
    const owner = pbRecordOwnerId(existing as { owner?: unknown; user?: unknown })
    if (owner !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    await deleteProjectScenesAndCharacters(pb, existingProjectId)

    noteTitle =
      typeof (existing as { name?: string }).name === 'string' && (existing as { name: string }).name.trim()
        ? (existing as { name: string }).name.trim()
        : stemTitle
  } else {
    noteTitle = (newProjectName && newProjectName.trim()) || stemTitle || 'Imported project'
  }

  const enrichment = await enrichScriptWithAi({
    projectName: noteTitle,
    sceneOutline,
    characterNames: mergedCharacterNames
  })

  const fullScriptText = parsed.scenes
    .map(s => `${s.heading}\n\n${s.body}`)
    .join('\n\n---\n\n')

  const [directorBible, claudeCharacterRows, claudeInferredScenes] = await Promise.all([
    inferDirectorFromImportedScript({
      projectName: noteTitle,
      logline: enrichment.logline,
      onePageSynopsis: enrichment.onePageSynopsis,
      genre: enrichment.genre,
      tone: enrichment.tone,
      themes: enrichment.themes,
      sceneOutline,
      characterNames: mergedCharacterNames
    }),
    inferCharactersWithScreenShareFromScript({
      projectName: noteTitle,
      logline: enrichment.logline,
      onePageSynopsis: enrichment.onePageSynopsis,
      genre: enrichment.genre,
      tone: enrichment.tone,
      sceneOutline,
      enrichmentHints: enrichment.characterRoles,
      parserCharacterNames: mergedCharacterNames
    }),
    inferScenesFromScriptWithClaude({
      projectName: noteTitle,
      genre: enrichment.genre,
      tone: enrichment.tone,
      characterNames: mergedCharacterNames,
      fullScriptText
    })
  ])

  let characterRows: CharacterWithShare[] =
    claudeCharacterRows.length > 0
      ? claudeCharacterRows
      : buildCharacterRowsFromFallback({
          enrichmentRoles: enrichment.characterRoles,
          parsed: { scenes: parsed.scenes, characterNames: mergedCharacterNames }
        })

  if (characterRows.length === 0) {
    const fromFullText = heuristicCharacterNamesFromScenes([
      { heading: 'FULL SCRIPT', body: fullScriptText.slice(0, 150_000) }
    ])
    const pool = filterLikelyCharacterNames([...mergedCharacterNames, ...fromFullText])
    if (pool.length > 0) {
      characterRows = normalizeCharacterShares(
        pool.map(name => ({
          name: name.slice(0, 200),
          role_description:
            'Identified from screenplay text. Use Characters → “Build / refresh cast from script” to refresh AI-written descriptions.',
          screen_share_percent: 0
        }))
      )
    }
  }

  characterRows = characterRows.filter(c => !isExcludedScreenplayCharacterLabel(c.name))

  const prose = enrichmentToProjectFields(enrichment)
  const threeAct = await inferThreeActThemeBreakdown({
    projectName: noteTitle,
    logline: enrichment.logline,
    onePageSynopsis: enrichment.onePageSynopsis,
    themeExploration: enrichment.themeExploration,
    sceneOutline
  })
  const treatmentWithActs = threeAct ? `${prose.treatment}\n\n${threeAct}` : prose.treatment
  const synopsisDb = prose.synopsis.slice(0, 20_000)
  const treatmentDb = treatmentWithActs.slice(0, 50_000)
  const directorFilled = Object.values(directorBible).some(
    v => typeof v === 'string' && v.trim().length > 0
  )

  const usedClaudeScenes = claudeInferredScenes.length > 0
  const sceneRowsForCreate: Array<{ heading: string; summary: string; body: string }> = usedClaudeScenes
    ? claudeInferredScenes.map(s => ({
        heading: s.heading,
        summary: s.summary,
        body: s.body
      }))
    : parsed.scenes.map((s, i) => ({
        heading: s.heading.slice(0, 500),
        summary: (
          enrichment.sceneSummaries.find(x => x.index === i)?.summary ||
          s.body.replace(/\s+/g, ' ').trim().slice(0, 280) ||
          s.heading
        ).slice(0, 2000),
        body: s.body.slice(0, 100_000)
      }))

  const conceptNotes =
    `Imported from ${filename}. ${sceneRowsForCreate.length} scene(s)${
      usedClaudeScenes ? ' (Claude breakdown — see Scenes tab)' : ''
    }. ` +
    'Synopsis: logline + one-page narrative. Treatment: comparable films, theme notes, and three-act breakdown — see Overview and Story tabs.' +
    (directorFilled
      ? ' Director bible (style, camera, lighting, pacing) was drafted from the script — review on the Director tab.'
      : '')

  if (existingProjectId) {
    await pb.collection('creative_projects').update(existingProjectId, {
      synopsis: synopsisDb,
      treatment: treatmentDb,
      concept_notes: conceptNotes,
      genre: enrichment.genre,
      tone: enrichment.tone,
      themes: enrichment.themes.length ? enrichment.themes : null,
      source_filename: filename,
      ...(directorFilled ? { director: directorBible } : {})
    })
    projectId = existingProjectId
  } else {
    const project = await pb.collection('creative_projects').create({
      name: noteTitle.slice(0, 500),
      owned_by: userId,
      aspect_ratio: aspectRatio,
      goal,
      target_length: 'short',
      synopsis: synopsisDb,
      treatment: treatmentDb,
      concept_notes: conceptNotes,
      genre: enrichment.genre,
      tone: enrichment.tone,
      themes: enrichment.themes.length ? enrichment.themes : null,
      source_filename: filename,
      ...(directorFilled ? { director: directorBible } : {})
    })
    projectId = project.id
  }

  const sceneRecords: Array<{ id: string; heading: string; summary: string; body: string }> = []
  for (let i = 0; i < sceneRowsForCreate.length; i++) {
    const s = normalizeCreativeSceneForPb(i, sceneRowsForCreate[i]!)
    const rec = await pb.collection('creative_scenes').create({
      owned_by: userId,
      project: projectId,
      sort_order: i + 1,
      heading: s.heading,
      summary: s.summary,
      body: s.body
    })
    sceneRecords.push({
      id: rec.id,
      heading: s.heading,
      summary: s.summary,
      body: s.body
    })
  }

  const seenChar = new Set<string>()
  for (const c of characterRows) {
    const key = c.name.toLowerCase()
    if (seenChar.has(key)) continue
    seenChar.add(key)
    await pb.collection('creative_characters').create({
      owned_by: userId,
      project: projectId,
      name: c.name.slice(0, 200),
      role_description: c.role_description.slice(0, 5000),
      screen_share_percent: c.screen_share_percent
    })
  }

  try {
    const projectRow = await pb.collection('creative_projects').getOne(projectId)
    const sb = await seedStoryboardsAfterScriptImport({
      pb,
      userId,
      projectId,
      project: projectRow as Record<string, unknown>,
      scenes: sceneRecords,
      characters: characterRows
    })
    const noteParts: string[] = []
    if (sb.ok > 0) {
      noteParts.push(
        ` Claude storyboard panels (shot list) were generated for ${sb.ok} scene(s) — open the Storyboard tab.`
      )
    }
    if (sb.capSkipped > 0) {
      noteParts.push(
        ` ${sb.capSkipped} scene(s) past the first ${IMPORT_STORYBOARD_MAX_SCENES} were not auto-boarded; use Generate Shots per scene there.`
      )
    }
    if (sb.failed > 0) {
      noteParts.push(` ${sb.failed} scene(s) could not auto-generate shots — use Storyboard → Generate Shots.`)
    }
    if (noteParts.length) {
      const prev = String((projectRow as { concept_notes?: string }).concept_notes || '')
      await pb.collection('creative_projects').update(projectId, {
        concept_notes: (prev + noteParts.join('')).slice(0, 50_000)
      })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[import-script] storyboard auto-seed skipped:', msg)
  }

  await deleteWorkflowScriptImportAssetsExcept(pb, userId, projectId, reuseAssetId)

  let scriptAsset: ScriptAssetAttachResult
  if (reuseAssetId) {
    scriptAsset = await updateScriptAssetAfterAnalysis(pb, reuseAssetId, {
      noteTitle,
      sceneCount: sceneRowsForCreate.length,
      filename
    })
  } else {
    scriptAsset = await attachScriptAsset({
      pb,
      userId,
      projectId,
      filename,
      fileBuf,
      noteTitle,
      sceneCount: sceneRowsForCreate.length
    })
  }

  const full = await pb.collection('creative_projects').getOne(projectId)
  return {
    project: pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0]),
    scriptAsset
  }
}

export async function importScriptIntoPocketBase (input: ScriptImportParams): Promise<{
  project: CreativeProject
  scriptAsset: ScriptAssetAttachResult
}> {
  const parsed = await parseScriptBufferToParsed(input.fileBuf, input.filename)
  const aspectRatio = normalizeAspect(input.aspectRatio)
  const goal = normalizeGoal(input.goal)
  const result = await runFullImportFromParsed({
    userId: input.userId,
    pb: input.pb,
    fileBuf: input.fileBuf,
    filename: input.filename,
    parsed,
    aspectRatio,
    goal,
    existingProjectId: input.existingProjectId,
    newProjectName: input.newProjectName,
    reuseAssetId: null
  })
  return { project: result.project, scriptAsset: result.scriptAsset }
}
