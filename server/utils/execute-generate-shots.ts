import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { parseDurationFromConceptNotes } from '~/lib/format-stored-concept'
import {
  perSceneShotCap,
  resolveProjectDurationBudget
} from '~/lib/project-duration-budget'
import type PocketBase from 'pocketbase'
import { checkShotsContinuity } from '~/server/utils/continuity-check-ai'
import { enrichGeneratedShotsForContinuity } from '~/server/utils/enrich-generated-shots'
import { loadCastMembersForContinuity } from '~/server/utils/project-character-prompt-refs'
import { summaryFromContinuityCheck, type ContinuityCheckSummary } from '~/lib/continuity-check-result'
import { generateShotsWithAi } from '~/server/utils/generate-shots-ai'
import { parseDirectorField } from '~/server/utils/creative-project-map'
import { pbRecordToCreativeScene } from '~/server/utils/creative-scene-map'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'
import { replaceSceneShots } from '~/server/utils/persist-scene-shots'
import { persistContinuityCheckOnProject } from '~/server/utils/persist-continuity-results'
import { persistContinuityFindingsToBible } from '~/server/utils/persist-continuity-bible-facts'
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
  continuity: ContinuityCheckSummary
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
  const sceneRec = pbRecordToCreativeScene(scene as Parameters<typeof pbRecordToCreativeScene>[0])
  if (sceneRec.projectId !== projectId) {
    throwApiError(400, ApiErrorCode.SCENE_WRONG_PROJECT, 'Scene does not belong to this project', {
      sceneId,
      projectId
    })
  }
  const sceneUser = pbRecordOwnerId(scene as { owner?: unknown; user?: unknown })
  if (sceneUser !== userId) {
    throwApiError(403, ApiErrorCode.FORBIDDEN, 'Forbidden', { resource: 'scene' })
  }

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

  const director = parseDirectorField(projectRec.director) ?? null
  let continuityMemory = String(projectRec.continuity_memory || '')
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
    const maxShots = Math.min(cap.maxShots, remaining)
    if (maxShots < 1) {
      throwApiError(
        400,
        ApiErrorCode.VALIDATION_ERROR,
        `Runtime budget is ~${durationBudget.totalSeconds}s (${durationBudget.maxPanelsTotal} panels at ${durationBudget.clipSeconds}s). Other scenes already use the panel cap — trim shots or raise target runtime on Overview.`,
        { projectId, sceneId, maxPanelsTotal: durationBudget.maxPanelsTotal }
      )
    }
    sceneShotCap = {
      minShots: Math.min(cap.minShots, maxShots),
      maxShots
    }
  }

  const shotsCtx = {
    projectName: String(projectRec.name || 'Project'),
    aspectRatio: String(projectRec.aspect_ratio || '16:9'),
    goal: String(projectRec.goal || 'film'),
    tone: String(projectRec.tone || 'cinematic'),
    sceneTitle: sceneRec.heading || 'Scene',
    sceneSummary: sceneRec.summary,
    sceneScript: sceneRec.body,
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

  const charactersSummary = shotsCtx.characters
    .map(c => `${c.name}: ${c.traitsRoleVisual || c.appearanceDescription || ''}`.trim())
    .filter(Boolean)
    .join('\n')

  console.log('[execute-generate-shots] continuity check starting', {
    projectId,
    sceneId,
    shotCount: generated.length
  })

  const continuityChecked = await checkShotsContinuity({
    shots: generated.map(s => ({
      ...s,
      duration_seconds: snapToStoryboardClipSeconds(s.duration_seconds)
    })),
    continuityMemory,
    director,
    sceneTitle: sceneRec.heading || 'Scene',
    charactersSummary,
    openrouterModelId: pref.openrouterModelId
  })

  console.log('[execute-generate-shots] continuity check complete', {
    projectId,
    sceneId,
    status: continuityChecked.status,
    issueCount: continuityChecked.status === 'ran' ? continuityChecked.issues.length : 0,
    memoryAppendChars: continuityChecked.memoryAppend.length,
    shotsRepaired: continuityChecked.status === 'ran' && continuityChecked.issues.length > 0
  })

  let memoryUpdated = false
  try {
    const persistedContinuity = await persistContinuityCheckOnProject({
      pb,
      projectId,
      existingMemory: continuityMemory,
      status: continuityChecked.status,
      issues: continuityChecked.issues,
      memoryAppend: continuityChecked.memoryAppend,
      detail: continuityChecked.detail
    })
    continuityMemory = persistedContinuity.continuityMemory
    memoryUpdated = persistedContinuity.memoryUpdated
  } catch (persistContinuityErr: unknown) {
    console.warn(
      '[execute-generate-shots] continuity persistence failed:',
      persistContinuityErr instanceof Error ? persistContinuityErr.message : persistContinuityErr
    )
    if (continuityChecked.status === 'ran' && continuityChecked.memoryAppend.trim()) {
      continuityMemory = `${continuityMemory.trim()}\n\n${continuityChecked.memoryAppend}`.trim()
      memoryUpdated = true
    }
  }

  if (continuityChecked.status === 'ran' && continuityChecked.issues.length > 0) {
    try {
      const castRows = shotsCtx.characters as Array<{ id?: string; name: string }>
      const bibleWriteback = await persistContinuityFindingsToBible({
        pb,
        userId,
        projectId,
        sceneId,
        checkStatus: continuityChecked.status,
        issues: continuityChecked.issues,
        characters: castRows
          .filter((c) => typeof c.id === 'string' && c.id && c.name.trim())
          .map((c) => ({ id: c.id!, name: c.name }))
      })
      if (bibleWriteback.created > 0 || bibleWriteback.failed) {
        console.log('[execute-generate-shots] continuity bible write-back', {
          projectId,
          sceneId,
          ...bibleWriteback
        })
      }
    } catch (bibleErr: unknown) {
      console.warn(
        '[execute-generate-shots] continuity bible write-back failed:',
        bibleErr instanceof Error ? bibleErr.message : bibleErr
      )
    }
  }

  const continuitySummary = summaryFromContinuityCheck({
    status: continuityChecked.status,
    issues: continuityChecked.issues,
    memoryUpdated,
    detail: continuityChecked.detail
  })

  const enrichCtx = { ...shotsCtx, continuityMemory }
  const finalShots = enrichGeneratedShotsForContinuity(continuityChecked.shots, enrichCtx)

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
    continuity: continuitySummary
  }
}
