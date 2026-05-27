import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { parseDurationFromConceptNotes } from '~/lib/format-stored-concept'
import {
  perSceneShotCap,
  resolveProjectDurationBudget
} from '~/lib/project-duration-budget'
import type PocketBase from 'pocketbase'
import { enrichGeneratedShotsForContinuity } from '~/server/utils/enrich-generated-shots'
import { loadCastMembersForContinuity } from '~/server/utils/project-character-prompt-refs'
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

export interface ExecuteGenerateShotsResult {
  shots: ReturnType<typeof pbRecordToCreativeShot>[]
  persisted: boolean
  warning: string
  continuity: { issueCount: number; memoryUpdated: boolean }
}

export async function executeGenerateShots (opts: {
  userId: string
  pb: PocketBase
  projectId: string
  sceneId: string
}): Promise<ExecuteGenerateShotsResult> {
  const { userId, pb, projectId, sceneId } = opts

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
    target_duration_seconds?: number
    target_length?: string
    concept_notes?: string
  }
  const sceneRec = scene as { heading?: string; summary?: string; body?: string }

  const director = parseDirectorField(projectRec.director) ?? null
  const continuityMemory = String(projectRec.continuity_memory || '')
  const pref = resolveProjectPreferredOpenRouterModel(project as Record<string, unknown>)

  const durationBudget = resolveProjectDurationBudget({
    targetDurationSeconds:
      typeof projectRec.target_duration_seconds === 'number' && projectRec.target_duration_seconds > 0
        ? projectRec.target_duration_seconds
        : parseDurationFromConceptNotes(String(projectRec.concept_notes || '')),
    targetLength: projectRec.target_length as import('~/types/creative-project').ProjectTargetLength | undefined,
    goal: projectRec.goal as import('~/types/creative-project').ProjectGoal | undefined
  })

  let sceneShotCap: { minShots: number; maxShots: number } | null = null
  if (durationBudget) {
    let allScenes: Array<{ id: string; sort_order?: number }> = []
    try {
      allScenes = (await pb.collection('creative_scenes').getFullList({
        filter: `project="${projectId}"`,
        sort: 'sort_order',
        batch: 200
      })) as Array<{ id: string; sort_order?: number }>
    } catch {
      allScenes = [{ id: sceneId }]
    }
    const sceneIndex = Math.max(
      0,
      allScenes.findIndex(s => s.id === sceneId)
    )
    const cap = perSceneShotCap(durationBudget, allScenes.length || 1, sceneIndex)
    let otherPanels = 0
    try {
      const existingShots = await pb.collection('creative_shots').getFullList({
        filter: `project="${projectId}"`,
        batch: 500
      })
      otherPanels = existingShots.filter(
        (s) =>
          String((s as { scene?: string }).scene || '') !== sceneId
      ).length
    } catch {
      otherPanels = 0
    }
    const remaining = Math.max(0, durationBudget.maxPanelsTotal - otherPanels)
    const maxShots = Math.min(cap.maxShots, remaining || cap.maxShots)
    sceneShotCap = {
      minShots: Math.min(cap.minShots, maxShots),
      maxShots: Math.max(1, maxShots)
    }
  }

  const shotsCtx = {
    projectName: String(projectRec.name || 'Project'),
    aspectRatio: String(projectRec.aspect_ratio || '16:9'),
    goal: String(projectRec.goal || 'film'),
    tone: String(projectRec.tone || 'cinematic'),
    sceneTitle: sceneRec.heading || 'Scene',
    sceneSummary: String(sceneRec.summary || ''),
    sceneScript: String(sceneRec.body || ''),
    characters: await loadCastMembersForContinuity(pb, projectId),
    director,
    continuityMemory,
    openrouterModelId: pref.openrouterModelId,
    durationBudget,
    sceneShotCap
  }

  let generated
  try {
    generated = await generateShotsWithAi(shotsCtx)
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

  const finalShots = enrichGeneratedShotsForContinuity(
    generated.map(s => ({
      ...s,
      duration_seconds: snapToStoryboardClipSeconds(s.duration_seconds)
    })),
    shotsCtx
  )

  let created: ReturnType<typeof pbRecordToCreativeShot>[] = []
  let persisted = true
  let warning = ''
  try {
    created = await replaceSceneShots(pb, userId, projectId, sceneId, finalShots)
    if (created.length === 0 && finalShots.length > 0) {
      throw new Error('creative_shots records were not created')
    }
  } catch (persistErr: unknown) {
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
      videoPrompt: s.video_prompt,
      negativePrompt: s.negative_prompt || ''
    }))
  }

  return {
    shots: created,
    persisted,
    warning,
    continuity: { issueCount: 0, memoryUpdated: false }
  }
}
