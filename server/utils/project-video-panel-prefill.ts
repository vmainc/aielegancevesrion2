import { createError } from 'h3'
import type PocketBase from 'pocketbase'
import { buildFullVideoGenerationPrompt } from '~/lib/shot-character-continuity'
import type { ProjectCharacterRef } from '~/lib/shot-character-continuity'
import { mapStoryboardAssetsToShots } from '~/lib/storyboard-panel-assets'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import type { VideoGenerationPrefill } from '~/lib/video-generation-prefill'
import type { ProjectAspectRatio } from '~/types/creative-project'

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

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
      roleDescription: String(row.role_description || '')
    }
  })

  const assetRows = await listProjectAssetsForProject(pb, projectId, userId, { kind: 'character' })
  const assets = assetRows.map(r => pbRecordToProjectAsset(r as Record<string, unknown>, pb))

  type Pick = { url: string; notes: string; promptUsed: string; ts: string; featured: boolean }
  const byId: Record<string, Pick> = {}
  const byName: Record<string, Pick> = {}

  for (const a of assets) {
    const meta = a.metadata || {}
    const cid = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    const cname = typeof meta.character_name === 'string' ? normalizeName(meta.character_name) : ''
    const featured = meta.featured === true
    const ts = a.updated || a.created || ''
    const notes = (a.notes || '').trim()
    const promptUsed =
      typeof meta.prompt_used === 'string'
        ? meta.prompt_used.trim()
        : typeof (meta as { promptUsed?: string }).promptUsed === 'string'
          ? String((meta as { promptUsed?: string }).promptUsed).trim()
          : ''
    const url = a.id ? projectAssetMediaPath(projectId, a.id) : (a.fileUrl || '').trim()
    if (!url && !notes && !promptUsed) continue

    const pick: Pick = { url, notes, promptUsed, ts, featured }
    const merge = (bucket: Record<string, Pick>, key: string) => {
      const prev = bucket[key]
      if (!prev || (featured && !prev.featured) || (featured === prev.featured && ts > prev.ts)) {
        bucket[key] = pick
      }
    }
    if (cid) merge(byId, cid)
    if (cname) merge(byName, cname)
  }

  return characters.map(c => {
    const hit = byId[c.id] || byName[normalizeName(c.name)]
    return {
      id: c.id,
      name: c.name,
      roleDescription: c.roleDescription,
      portraitUrl: hit?.url || null,
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

/** Build video-generation prefill from saved project panel ids (authoritative in production). */
export async function buildVideoPanelPrefill (input: {
  pb: PocketBase
  userId: string
  projectId: string
  sceneId: string
  shotId: string
}): Promise<VideoGenerationPrefill> {
  const { pb, userId, projectId, sceneId, shotId } = input

  const projectRow = await pb.collection('creative_projects').getOne(projectId)
  const project = pbRecordToCreativeProject(projectRow as Parameters<typeof pbRecordToCreativeProject>[0])

  const sceneRow = await pb.collection('creative_scenes').getOne(sceneId)
  const sceneProject =
    typeof sceneRow.project === 'string'
      ? sceneRow.project
      : (sceneRow.project as { id?: string })?.id
  if (sceneProject !== projectId) {
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

  const storyboardRows = await listProjectAssetsForProject(pb, projectId, userId, {
    kind: 'storyboard'
  })
  const storyboardAssets = storyboardRows.map(r =>
    pbRecordToProjectAsset(r as Record<string, unknown>, pb)
  )
  const frameAsset = mapStoryboardAssetsToShots(sceneShots, storyboardAssets, sceneId).get(shotId)
  if (!frameAsset?.id) {
    throw createError({
      statusCode: 400,
      message: 'No storyboard frame saved for this panel — generate an image on Storyboard first.'
    })
  }

  const cast = await loadProjectCharacterRefs(pb, projectId, userId)
  const prompt = buildFullVideoGenerationPrompt({
    director: project.director,
    continuityMemory: project.continuityMemory,
    aspectRatio: project.aspectRatio as ProjectAspectRatio,
    targetLength: project.targetLength,
    scene: {
      heading: String(sceneRow.heading || ''),
      summary: String(sceneRow.summary || '')
    },
    shot,
    cast
  }).trim()

  if (!prompt) {
    throw createError({ statusCode: 400, message: 'This panel has no production prompt yet.' })
  }

  return {
    prompt,
    startFrameUrl: projectAssetMediaPath(projectId, frameAsset.id),
    aspectRatio: projectAspectForVideo(project.aspectRatio),
    durationSeconds: snapToStoryboardClipSeconds(Number(shot.durationSeconds) || 5),
    projectId,
    saveToProject: true,
    shotTitle: shot.title || undefined,
    sceneId,
    shotId,
    source: 'project_video_panel'
  }
}
