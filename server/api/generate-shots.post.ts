import { createError, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { checkShotsContinuity } from '~/server/utils/continuity-check-ai'
import { generateShotsWithAi } from '~/server/utils/generate-shots-ai'
import { parseDirectorField } from '~/server/utils/creative-project-map'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => null) as {
    project_id?: string
    scene_id?: string
  } | null

  const projectId = body?.project_id?.trim()
  const sceneId = body?.scene_id?.trim()
  if (!projectId || !sceneId) {
    throw createError({ statusCode: 400, message: 'project_id and scene_id are required' })
  }

  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  const owner = typeof project.user === 'string' ? project.user : (project.user as { id?: string })?.id
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const scene = await pb.collection('creative_scenes').getOne(sceneId)
  const sceneProject =
    typeof scene.project === 'string' ? scene.project : (scene.project as { id?: string })?.id
  if (sceneProject !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }
  const sceneUser = typeof scene.user === 'string' ? scene.user : (scene.user as { id?: string })?.id
  if (sceneUser !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const charFilter = `project="${projectId}"`
  const characters = await pb.collection('creative_characters').getFullList({ filter: charFilter, batch: 200 })

  const director = parseDirectorField(project.director) ?? null
  const continuityMemory = String(project.continuity_memory || '')

  let generated
  try {
    generated = await generateShotsWithAi({
      projectName: project.name,
      aspectRatio: String(project.aspect_ratio || '16:9'),
      goal: String(project.goal || 'film'),
      tone: String(project.tone || 'cinematic'),
      sceneTitle: scene.heading || 'Scene',
      sceneSummary: String(scene.summary || ''),
      sceneScript: String(scene.body || ''),
      characters: characters.map(c => ({
        name: c.name,
        traitsRoleVisual: String(c.role_description || '')
      })),
      director,
      continuityMemory
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Shot generation failed'
    throw createError({ statusCode: 502, message: msg })
  }

  const continuity = await checkShotsContinuity({
    shots: generated,
    continuityMemory,
    director,
    sceneTitle: scene.heading || 'Scene',
    charactersSummary: characters
      .map(c => `${c.name}: ${String(c.role_description || '').trim() || '(role TBD)'}`)
      .join('\n')
  })

  const finalShots = continuity.shots
  const issuesText =
    continuity.issues.length > 0
      ? continuity.issues.map(i => `• ${i}`).join('\n')
      : 'No issues detected in the last continuity check.'

  const prevMem = continuityMemory.trim()
  const append = continuity.memoryAppend.trim()
  const nextMem = append
    ? (prevMem ? `${prevMem}\n\n${append}` : append).slice(0, 50000)
    : prevMem

  try {
    await pb.collection('creative_projects').update(projectId, {
      continuity_last_issues: issuesText,
      ...(append ? { continuity_memory: nextMem } : {})
    })
  } catch (e) {
    console.warn('[generate-shots] continuity fields update skipped:', e)
  }

  let existing: { id: string }[] = []
  try {
    existing = await pb.collection('creative_shots').getFullList({
      filter: `scene="${sceneId}"`,
      batch: 200
    })
  } catch {
    throw createError({
      statusCode: 503,
      message:
        'creative_shots collection missing. Run: node scripts/setup-collections.js on PocketBase admin.'
    })
  }
  for (const row of existing) {
    await pb.collection('creative_shots').delete(row.id)
  }

  const created: ReturnType<typeof pbRecordToCreativeShot>[] = []
  for (let i = 0; i < finalShots.length; i++) {
    const g = finalShots[i]
    let rec
    try {
      rec = await pb.collection('creative_shots').create({
      project: projectId,
      scene: sceneId,
      user: userId,
      sort_order: g.order - 1,
      title: g.title,
      description: g.description,
      shot_type: g.shot_type,
      camera_move: g.camera_move,
      duration_seconds: g.duration_seconds,
      image_prompt: g.image_prompt,
      video_prompt: g.video_prompt
      })
    } catch {
      throw createError({
        statusCode: 503,
        message:
          'Could not save shots — ensure creative_shots collection exists (setup-collections.js).'
      })
    }
    created.push(pbRecordToCreativeShot(rec as Parameters<typeof pbRecordToCreativeShot>[0]))
  }

  created.sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    shots: created,
    continuity: {
      issueCount: continuity.issues.length,
      memoryUpdated: Boolean(append)
    }
  }
})
