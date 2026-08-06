import { createError } from 'h3'
import type PocketBase from 'pocketbase'
import { buildFullVideoGenerationPrompt } from '~/lib/shot-character-continuity'
import type { ProjectCharacterRef } from '~/lib/shot-character-continuity'
import { projectCharacterRefToCastMember } from '~/lib/shot-character-continuity'
import { buildCharacterPlateMap } from '~/lib/character-plate-refs'
import {
  resolveVideoNegativePromptForShot,
  stripStrictExclusionsFromPrompt
} from '~/lib/video-negative-prompt'
import { mapStoryboardFrameAssetsToShots } from '~/lib/storyboard-panel-assets'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { projectIdOnSceneRow } from '~/server/utils/creative-scene-map'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import { resolveProductionBibleForGeneration } from '~/server/utils/resolve-production-bible-for-generation'
import { mergeProductionBibleGenerationOptions } from '~/lib/production-bible-generation-context'
import type { VideoGenerationPrefill } from '~/lib/video-generation-prefill'
import type { ProjectAspectRatio } from '~/types/creative-project'

async function loadProjectCharacterRefs (
  pb: PocketBase,
  projectId: string,
  userId: string
): Promise<ProjectCharacterRef[]> {
  const charRows = await pb.collection('creative_characters').getFullList({
    filter: `project="${projectId}"`,
    batch: 200
  })

  const characters = charRows.map(r => {
    const row = r as Record<string, unknown>
    return {
      id: String(row.id),
      name: String(row.name || ''),
      roleDescription: String(row.role_description || ''),
      appearanceDescription: String(row.appearance_description || ''),
      signatureDetails: String(row.signature_details || ''),
      avoidDescription: String(row.avoid_description || ''),
      voiceDescription: String(row.voice_description || '')
    }
  })

  const assetRows = await listProjectAssetsForProject(pb, projectId, userId, { kind: 'character' })
  const assets = assetRows.map(r => pbRecordToProjectAsset(r as Record<string, unknown>, pb))
  const plates = buildCharacterPlateMap(
    characters,
    assets,
    (a) => (a.id ? projectAssetMediaPath(projectId, a.id) : (a.fileUrl || '').trim())
  )

  return characters.map(c => {
    const hit = plates.get(c.id)
    return {
      id: c.id,
      name: c.name,
      roleDescription: c.roleDescription,
      appearanceDescription: c.appearanceDescription || undefined,
      signatureDetails: c.signatureDetails || undefined,
      avoidDescription: c.avoidDescription || undefined,
      voiceDescription: c.voiceDescription || undefined,
      portraitUrl: hit?.url || null,
      plateUrls: hit?.plateUrls || [],
      portraitNotes: hit?.notes,
      portraitPromptUsed: hit?.promptUsed
    }
  })
}

function projectAspectForVideo (aspect?: string): VideoGenerationPrefill['aspectRatio'] {
  if (aspect === '9:16') return '9:16'
  if (aspect === '1:1') return '1:1'
  return '16:9'
}

/** Match client video step: project storyboard assets + in-memory kind filter fallbacks. */
async function loadStoryboardAssetsForPanelPrefill (
  pb: PocketBase,
  projectId: string,
  userId: string
): Promise<unknown[]> {
  const byId = new Map<string, unknown>()

  const ingest = (rows: unknown[]) => {
    for (const r of rows) {
      const row = r as Record<string, unknown>
      const id = String(row.id || '')
      if (!id) continue
      const kind = String(row.kind || '')
      if (kind && kind !== 'storyboard') continue
      byId.set(id, r)
    }
  }

  try {
    ingest(await listProjectAssetsForProject(pb, projectId, userId, { kind: 'storyboard' }))
  } catch {
    /* try broader queries */
  }

  try {
    ingest(await listProjectAssetsForProject(pb, projectId, userId))
  } catch {
    /* last resort below */
  }

  if (byId.size === 0) {
    try {
      const all = await pb.collection('project_assets').getFullList({
        filter: `owned_by = "${userId}"`,
        sort: '-created',
        batch: 400
      })
      for (const r of all) {
        const row = r as Record<string, unknown>
        const pid =
          typeof row.project === 'string'
            ? row.project
            : (row.project as { id?: string })?.id
        if (pid !== projectId) continue
        if (String(row.kind || '') !== 'storyboard') continue
        const id = String(row.id || '')
        if (id) byId.set(id, r)
      }
    } catch {
      /* empty */
    }
  }

  return [...byId.values()]
}

/** Build video-generation prefill from saved project panel ids (authoritative in production). */
export async function buildVideoPanelPrefill (input: {
  pb: PocketBase
  userId: string
  projectId: string
  sceneId: string
  shotId: string
  /** When set, only these cast members are woven into the production prompt. */
  characterIds?: string[]
}): Promise<VideoGenerationPrefill> {
  const { pb, userId, projectId, sceneId, shotId, characterIds: characterIdsFilter } = input

  const projectRow = await pb.collection('creative_projects').getOne(projectId)
  const project = pbRecordToCreativeProject(projectRow as Parameters<typeof pbRecordToCreativeProject>[0])

  const sceneRow = await pb.collection('creative_scenes').getOne(sceneId)
  if (projectIdOnSceneRow(sceneRow as Record<string, unknown>) !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }

  const shotRow = await pb.collection('creative_shots').getOne(shotId)
  const shot = pbRecordToCreativeShot(shotRow as Parameters<typeof pbRecordToCreativeShot>[0])
  if (shot.sceneId !== sceneId) {
    throw createError({ statusCode: 400, message: 'Shot does not belong to this scene' })
  }

  const shotList = await pb.collection('creative_shots').getFullList({
    filter: `scene="${sceneId}"`,
    sort: 'sort_order',
    batch: 200
  })
  const sceneShots = shotList
    .map(r => pbRecordToCreativeShot(r as Parameters<typeof pbRecordToCreativeShot>[0]))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const storyboardRows = await loadStoryboardAssetsForPanelPrefill(pb, projectId, userId)
  const storyboardAssets = storyboardRows.map(r =>
    pbRecordToProjectAsset(r as Record<string, unknown>, pb)
  )
  const frameMap = mapStoryboardFrameAssetsToShots(sceneShots, storyboardAssets, sceneId).get(shotId)
  const startAsset = frameMap?.start
  if (!startAsset?.id) {
    throw createError({
      statusCode: 400,
      message: 'No storyboard frame saved for this panel — generate an image on Storyboard first.'
    })
  }
  const endAsset = frameMap?.end

  let cast = await loadProjectCharacterRefs(pb, projectId, userId)
  if (characterIdsFilter !== undefined) {
    const allowed = new Set(characterIdsFilter.filter(Boolean))
    cast = cast.filter((c) => allowed.has(c.id))
  }
  const castMembers = cast.map(c => projectCharacterRefToCastMember(c))

  const { context: productionBible } = await resolveProductionBibleForGeneration(pb, projectId, {
    ...mergeProductionBibleGenerationOptions(),
    sceneId,
    shotId,
    characterIds: cast.map((c) => c.id)
  })

  const promptCtx = {
    director: project.director,
    continuityMemory: project.continuityMemory,
    aspectRatio: project.aspectRatio,
    sceneTitle: String(sceneRow.heading || ''),
    sceneSummary: String(sceneRow.summary || ''),
    cast: castMembers
  }

  const negativePrompt = resolveVideoNegativePromptForShot(shot, promptCtx).trim()

  const fullPrompt = buildFullVideoGenerationPrompt({
    director: project.director,
    continuityMemory: project.continuityMemory,
    aspectRatio: project.aspectRatio as ProjectAspectRatio,
    targetLength: project.targetLength,
    scene: {
      heading: String(sceneRow.heading || ''),
      summary: String(sceneRow.summary || '')
    },
    shot,
    cast,
    productionBible
  }).trim()

  const prompt = negativePrompt
    ? stripStrictExclusionsFromPrompt(fullPrompt)
    : fullPrompt

  if (!prompt && !negativePrompt) {
    throw createError({ statusCode: 400, message: 'This panel has no production prompt yet.' })
  }

  return {
    prompt: prompt || fullPrompt,
    negativePrompt: negativePrompt || undefined,
    startFrameUrl: projectAssetMediaPath(projectId, startAsset.id),
    endFrameUrl: endAsset?.id ? projectAssetMediaPath(projectId, endAsset.id) : undefined,
    aspectRatio: projectAspectForVideo(project.aspectRatio),
    durationSeconds: snapToStoryboardClipSeconds(Number(shot.durationSeconds) || 5),
    projectId,
    saveToProject: true,
    shotTitle: shot.title || undefined,
    sceneId,
    shotId,
    characterIds: cast.map((c) => c.id),
    source: 'project_video_panel',
    productionBibleContext: productionBible ?? undefined
  }
}
