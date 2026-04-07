import { createError } from 'h3'
import type PocketBase from 'pocketbase'
import type { ParsedScript } from '~/server/utils/parse-script-fdx'
import { parseFdxXml } from '~/server/utils/parse-script-fdx'
import { parsePlainScriptText } from '~/server/utils/parse-script-txt'
import { extractTextFromPdfBuffer } from '~/server/utils/extract-pdf-text'
import {
  enrichScriptWithAi,
  enrichmentToProjectFields,
  inferThreeActThemeBreakdown,
  inferDirectorFromImportedScript,
  inferCharactersWithScreenShareFromScript,
  inferScenesFromScriptWithClaude,
  buildCharacterRowsFromFallback,
  type CharacterWithShare
} from '~/server/utils/script-import-ai'
import {
  IMPORT_STORYBOARD_MAX_SCENES,
  seedStoryboardsAfterScriptImport
} from '~/server/utils/import-storyboard-seed'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
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

export type ScriptAssetAttachResult =
  | { ok: true; id: string }
  | { ok: false; message: string }

async function deleteProjectScenesAndCharacters (pb: PocketBase, projectId: string) {
  const scenes = await pb.collection('creative_scenes').getFullList({
    filter: `project = "${projectId}"`,
    batch: 200
  })
  for (const s of scenes) {
    await pb.collection('creative_scenes').delete(s.id)
  }
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
    throw createError({ statusCode: 400, message: 'No scenes found in file' })
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

  try {
    const formData = new FormData()
    formData.append('owned_by', userId)
    formData.append('project', projectId)
    formData.append('kind', 'script')
    formData.append('title', titleFromFile.slice(0, 500))
    formData.append('notes', notes.slice(0, 8000))
    formData.append('sort_order', '0')
    formData.append(
      'metadata',
      JSON.stringify({
        source: 'script_import',
        analysis_status: 'pending',
        preview_scene_count: previewSceneCount,
        original_filename: filename.slice(0, 500),
        ...(parseWarning ? { parse_warning: parseWarning.slice(0, 500) } : {})
      })
    )
    const uint8 = fileBuf instanceof Uint8Array ? fileBuf : new Uint8Array(fileBuf)
    const blob = new Blob([uint8])
    formData.append('file', blob, safeFilename)
    const created = await pb.collection('project_assets').create(formData)
    const id = String((created as { id?: string }).id || '').trim()
    if (!id) {
      return { ok: false, message: 'project_assets row created without an id.' }
    }
    return { ok: true, id }
  } catch (assetErr: unknown) {
    const msg = assetErr instanceof Error ? assetErr.message : String(assetErr)
    console.warn('[import-script] pending project_assets create failed:', msg)
    return {
      ok: false,
      message: msg || 'Could not save the script file to project assets.'
    }
  }
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

  try {
    const formData = new FormData()
    formData.append('owned_by', userId)
    formData.append('project', projectId)
    formData.append('kind', 'script')
    formData.append('title', titleFromFile.slice(0, 500))
    formData.append(
      'notes',
      `Imported script for “${noteTitle}”. ${sceneCount} scene(s).`
    )
    formData.append('sort_order', '0')
    formData.append(
      'metadata',
      JSON.stringify({
        source: 'script_import',
        analysis_status: 'complete',
        scene_count: sceneCount,
        original_filename: filename.slice(0, 500)
      })
    )
    const uint8 = fileBuf instanceof Uint8Array ? fileBuf : new Uint8Array(fileBuf)
    const blob = new Blob([uint8])
    formData.append('file', blob, safeFilename)
    const created = await pb.collection('project_assets').create(formData)
    const id = String((created as { id?: string }).id || '').trim()
    if (!id) {
      return { ok: false, message: 'project_assets row created without an id.' }
    }
    return { ok: true, id }
  } catch (assetErr: unknown) {
    const msg = assetErr instanceof Error ? assetErr.message : String(assetErr)
    console.warn('[import-script] project_assets create failed:', msg)
    return {
      ok: false,
      message:
        msg ||
        'Could not save the script file to project assets. Check project_assets rules and file size limits.'
    }
  }
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

/**
 * Run full AI import from an existing project_assets screenplay row (file downloaded from PB).
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

  const aspectRatio = normalizeAspect(String((projectRow as { aspect_ratio?: string }).aspect_ratio || '16:9'))
  const goal = normalizeGoal(String((projectRow as { goal?: string }).goal || 'film'))

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
    const list = await pb.collection('project_assets').getFullList({
      filter: `project = "${projectId}" && owned_by = "${userId}" && kind = "script"`,
      sort: '-created',
      batch: 80
    })
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
  const filename = origName || 'script.upload'

  const fileBuf = await downloadProjectAssetFileBuffer(pb, assetRow)
  const parsed = await parseScriptBufferToParsed(fileBuf, filename)

  return runFullImportFromParsed({
    userId,
    pb,
    fileBuf,
    filename,
    parsed,
    aspectRatio,
    goal,
    existingProjectId: projectId,
    reuseAssetId: String(assetRow.id)
  })
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
    characterNames: parsed.characterNames
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
      characterNames: parsed.characterNames
    }),
    inferCharactersWithScreenShareFromScript({
      projectName: noteTitle,
      logline: enrichment.logline,
      onePageSynopsis: enrichment.onePageSynopsis,
      genre: enrichment.genre,
      tone: enrichment.tone,
      sceneOutline,
      enrichmentHints: enrichment.characterRoles,
      parserCharacterNames: parsed.characterNames
    }),
    inferScenesFromScriptWithClaude({
      projectName: noteTitle,
      genre: enrichment.genre,
      tone: enrichment.tone,
      characterNames: parsed.characterNames,
      fullScriptText
    })
  ])

  const characterRows: CharacterWithShare[] =
    claudeCharacterRows.length > 0
      ? claudeCharacterRows
      : buildCharacterRowsFromFallback({
          enrichmentRoles: enrichment.characterRoles,
          parsed: { scenes: parsed.scenes, characterNames: parsed.characterNames }
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
    const s = sceneRowsForCreate[i]!
    const rec = await pb.collection('creative_scenes').create({
      owned_by: userId,
      project: projectId,
      sort_order: i,
      heading: s.heading.slice(0, 500),
      summary: s.summary.slice(0, 2000),
      body: s.body.slice(0, 100_000)
    })
    sceneRecords.push({
      id: rec.id,
      heading: s.heading.slice(0, 500),
      summary: s.summary.slice(0, 2000),
      body: s.body.slice(0, 100_000)
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
