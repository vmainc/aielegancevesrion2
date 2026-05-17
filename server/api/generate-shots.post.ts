import { readBody } from 'h3'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { checkShotsContinuity } from '~/server/utils/continuity-check-ai'
import { generateShotsWithAi } from '~/server/utils/generate-shots-ai'
import { parseDirectorField } from '~/server/utils/creative-project-map'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'
import { replaceSceneShots } from '~/server/utils/persist-scene-shots'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { resolveProjectPreferredOpenRouterModel } from '~/server/utils/project-model-preference'
import { ApiErrorCode, isAbortLikeError, throwApiError } from '~/server/utils/api-error-envelope'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => null) as {
    project_id?: string
    scene_id?: string
  } | null

  const projectId = body?.project_id?.trim()
  const sceneId = body?.scene_id?.trim()
  if (!projectId || !sceneId) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'project_id and scene_id are required')
  }

  const pb = await getAuthenticatedPocketBase()

  let project: unknown
  try {
    project = await pb.collection('creative_projects').getOne(projectId)
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throwApiError(
        503,
        ApiErrorCode.MISSING_COLLECTION,
        'PocketBase creative_projects collection is missing or not provisioned.',
        { collection: 'creative_projects' }
      )
    }
    if (pocketBaseErrorStatus(e) === 404) {
      throwApiError(404, ApiErrorCode.PROJECT_NOT_FOUND, 'Project not found.', { projectId })
    }
    throw e
  }
  const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throwApiError(403, ApiErrorCode.FORBIDDEN, 'Forbidden', { resource: 'project' })
  }

  let scene: unknown
  try {
    scene = await pb.collection('creative_scenes').getOne(sceneId)
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throwApiError(
        503,
        ApiErrorCode.MISSING_COLLECTION,
        'PocketBase creative_scenes collection is missing or not provisioned.',
        { collection: 'creative_scenes' }
      )
    }
    if (pocketBaseErrorStatus(e) === 404) {
      throwApiError(404, ApiErrorCode.NOT_FOUND, 'Scene not found.', { sceneId })
    }
    throw e
  }
  const sceneProject =
    typeof (scene as { project?: unknown }).project === 'string'
      ? (scene as { project: string }).project
      : ((scene as { project?: { id?: string } }).project as { id?: string } | undefined)?.id
  if (sceneProject !== projectId) {
    throwApiError(400, ApiErrorCode.SCENE_WRONG_PROJECT, 'Scene does not belong to this project', {
      sceneId,
      projectId
    })
  }
  const sceneUser = pbRecordOwnerId(scene as { owner?: unknown; user?: unknown })
  if (sceneUser !== userId) {
    throwApiError(403, ApiErrorCode.FORBIDDEN, 'Forbidden', { resource: 'scene' })
  }

  const charFilter = `project="${projectId}"`
  const characters = await pb.collection('creative_characters').getFullList({ filter: charFilter, batch: 200 })

  const projectRec = project as {
    director?: unknown
    continuity_memory?: string
    name?: string
    aspect_ratio?: string
    goal?: string
    tone?: string
  }
  const sceneRec = scene as { heading?: string; summary?: string; body?: string }

  const director = parseDirectorField(projectRec.director) ?? null
  const continuityMemory = String(projectRec.continuity_memory || '')
  const pref = resolveProjectPreferredOpenRouterModel(project as Record<string, unknown>)

  let generated
  try {
    generated = await generateShotsWithAi({
      projectName: String(projectRec.name || 'Project'),
      aspectRatio: String(projectRec.aspect_ratio || '16:9'),
      goal: String(projectRec.goal || 'film'),
      tone: String(projectRec.tone || 'cinematic'),
      sceneTitle: sceneRec.heading || 'Scene',
      sceneSummary: String(sceneRec.summary || ''),
      sceneScript: String(sceneRec.body || ''),
      characters: characters.map(c => ({
        name: c.name,
        traitsRoleVisual: String(c.role_description || '')
      })),
      director,
      continuityMemory,
      openrouterModelId: pref.openrouterModelId
    })
  } catch (e: unknown) {
    if (isAbortLikeError(e)) {
      throwApiError(
        504,
        ApiErrorCode.OPENROUTER_TIMEOUT,
        'Shot generation timed out. Try again or pick a faster model.',
        { projectId, sceneId }
      )
    }
    const msg = e instanceof Error ? e.message : 'Shot generation failed'
    if (/openrouter api key not configured/i.test(msg)) {
      throwApiError(
        500,
        ApiErrorCode.OPENROUTER_NOT_CONFIGURED,
        'OpenRouter API key not configured. Set OPENROUTER_API_KEY or NUXT_OPENROUTER_API_KEY.'
      )
    }
    throwApiError(502, ApiErrorCode.OPENROUTER_UPSTREAM, msg, { projectId, sceneId })
  }

  const continuity = await checkShotsContinuity({
    shots: generated,
    continuityMemory,
    director,
    sceneTitle: sceneRec.heading || 'Scene',
    charactersSummary: characters
      .map(c => `${c.name}: ${String(c.role_description || '').trim() || '(role TBD)'}`)
      .join('\n'),
    openrouterModelId: pref.openrouterModelId
  })

  const finalShots = continuity.shots.map(s => ({
    ...s,
    duration_seconds: snapToStoryboardClipSeconds(s.duration_seconds)
  }))
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

  let created: ReturnType<typeof pbRecordToCreativeShot>[] = []
  let persisted = true
  let warning = ''
  try {
    created = await replaceSceneShots(pb, userId, projectId, sceneId, finalShots)
  } catch (persistErr: unknown) {
    // Graceful fallback: still return generated shots so Storyboard can render cards.
    persisted = false
    const detail = formatPocketBaseRecordError(persistErr).trim()
    console.error('[generate-shots] persist failed:', detail || persistErr)
    warning = detail
      ? `Shots generated, but could not save to PocketBase: ${detail.slice(0, 500)}`
      : 'Shots generated, but could not save to PocketBase (creative_shots missing or unreadable).'
    created = finalShots.map((s, idx) => ({
      id: `preview_${sceneId}_${idx + 1}`,
      projectId,
      sceneId,
      sortOrder: Math.max(0, s.order - 1),
      title: s.title,
      description: s.description,
      shotType: s.shot_type,
      cameraMove: s.camera_move,
      durationSeconds: s.duration_seconds,
      imagePrompt: s.image_prompt,
      videoPrompt: s.video_prompt
    }))
  }

  return {
    shots: created,
    persisted,
    warning,
    continuity: {
      issueCount: continuity.issues.length,
      memoryUpdated: Boolean(append)
    }
  }
})
