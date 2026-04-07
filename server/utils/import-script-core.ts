import { createError } from 'h3'
import type PocketBase from 'pocketbase'
import { parseFdxXml } from '~/server/utils/parse-script-fdx'
import { parsePlainScriptText } from '~/server/utils/parse-script-txt'
import { extractTextFromPdfBuffer } from '~/server/utils/extract-pdf-text'
import {
  enrichScriptWithAi,
  enrichmentToProjectFields,
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

async function attachScriptAsset (params: {
  pb: PocketBase
  userId: string
  projectId: string
  filename: string
  fileBuf: Buffer
  noteTitle: string
  sceneCount: number
}) {
  const { pb, userId, projectId, filename, fileBuf, noteTitle, sceneCount } = params
  try {
    const formData = new FormData()
    formData.append('owned_by', userId)
    formData.append('project', projectId)
    formData.append('kind', 'script')
    formData.append('title', filename.slice(0, 500))
    formData.append(
      'notes',
      `Imported script for “${noteTitle}”. ${sceneCount} scene(s).`
    )
    formData.append('sort_order', '0')
    formData.append(
      'metadata',
      JSON.stringify({
        source: 'script_import',
        scene_count: sceneCount
      })
    )
    const uint8 = fileBuf instanceof Uint8Array ? fileBuf : new Uint8Array(fileBuf)
    const blob = new Blob([uint8])
    formData.append('file', blob, filename)
    await pb.collection('project_assets').create(formData)
  } catch (assetErr: unknown) {
    const msg = assetErr instanceof Error ? assetErr.message : String(assetErr)
    console.warn('[import-script] project_assets library row skipped:', msg)
  }
}

export async function importScriptIntoPocketBase (input: ScriptImportParams): Promise<{
  project: CreativeProject
}> {
  const aspectRatio = normalizeAspect(input.aspectRatio)
  const goal = normalizeGoal(input.goal)

  const { fileBuf, filename, userId, pb } = input
  const lower = filename.toLowerCase()
  const isFdx = lower.endsWith('.fdx')
  const isTxt = lower.endsWith('.txt')
  const isPdf = lower.endsWith('.pdf')
  if (!isFdx && !isTxt && !isPdf) {
    throw createError({ statusCode: 400, message: 'Only .fdx, .txt, and .pdf files are supported' })
  }

  let parsed
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

  const sceneOutline = parsed.scenes
    .map((s, i) => `## Scene ${i}\nHeading: ${s.heading}\n---\n${s.body.slice(0, 2500)}`)
    .join('\n\n')

  const stemTitle =
    filename.replace(/\.(fdx|txt|pdf)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported script'

  let projectId: string
  let noteTitle: string

  if (input.existingProjectId) {
    const existing = await pb.collection('creative_projects').getOne(input.existingProjectId)
    const owner = pbRecordOwnerId(existing as { owner?: unknown; user?: unknown })
    if (owner !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    await deleteProjectScenesAndCharacters(pb, input.existingProjectId)

    noteTitle =
      typeof (existing as { name?: string }).name === 'string' && (existing as { name: string }).name.trim()
        ? (existing as { name: string }).name.trim()
        : stemTitle
  } else {
    noteTitle =
      (input.newProjectName && input.newProjectName.trim()) || stemTitle || 'Imported project'
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

  const { synopsis: synopsisProse, treatment: treatmentProse } = enrichmentToProjectFields(enrichment)
  const synopsisDb = synopsisProse.slice(0, 20_000)
  const treatmentDb = treatmentProse.slice(0, 50_000)
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
    'Synopsis: logline + one-page narrative. Treatment: comparable films + theme exploration — open the Story tab to read or regenerate treatment later.' +
    (directorFilled
      ? ' Director bible (style, camera, lighting, pacing) was drafted from the script — review on the Director tab.'
      : '')

  if (input.existingProjectId) {
    await pb.collection('creative_projects').update(input.existingProjectId, {
      synopsis: synopsisDb,
      treatment: treatmentDb,
      concept_notes: conceptNotes,
      genre: enrichment.genre,
      tone: enrichment.tone,
      themes: enrichment.themes.length ? enrichment.themes : null,
      source_filename: filename,
      ...(directorFilled ? { director: directorBible } : {})
    })
    projectId = input.existingProjectId
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

  await attachScriptAsset({
    pb,
    userId,
    projectId,
    filename,
    fileBuf,
    noteTitle,
    sceneCount: sceneRowsForCreate.length
  })

  const full = await pb.collection('creative_projects').getOne(projectId)
  return {
    project: pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0])
  }
}
