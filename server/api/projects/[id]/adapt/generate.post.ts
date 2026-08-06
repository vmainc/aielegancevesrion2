import { createError, getRouterParam, readBody } from 'h3'
import { randomBytes } from 'node:crypto'
import {
  computeProductionSummary,
  defaultProductionChecklist,
  emptyTreatmentContent,
  filterUnlockedScenes,
  validateAdaptSourceText
} from '~/lib/adapt-to-film'
import type {
  AdaptJobKind,
  AdaptScene,
  AdaptShot,
  AdaptToFilmState,
  AdaptTreatmentVersion
} from '~/types/adapt-to-film'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { loadAdaptState, saveAdaptState } from '~/server/utils/adapt-to-film-state'
import { syncAdaptScenesAndShotsToCreative } from '~/server/utils/adapt-to-film-sync'
import {
  createJob,
  releaseAdaptSubmitLock,
  adaptSubmitLockKey,
  tryAcquireAdaptSubmitLock,
  updateJob,
  pruneOldJobs
} from '~/server/utils/adapt-to-film-job-registry'
import {
  extractAssets,
  extractCharacters,
  generateFilmTreatment,
  generateSceneBreakdown,
  generateSceneShots,
  regenerateScene,
  regenerateShot,
  regenerateShotPrompt,
  regenerateTreatmentSection
} from '~/server/utils/adapt-to-film-ai'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'

const KINDS = new Set<AdaptJobKind>([
  'analyze_source',
  'treatment',
  'treatment_section',
  'scenes',
  'scene',
  'shots',
  'shot',
  'shot_prompt',
  'extract_characters',
  'extract_assets'
])

function newLocalId (prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing project id' })

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throwApiError(
      500,
      ApiErrorCode.OPENROUTER_NOT_CONFIGURED,
      'OpenRouter API key not configured. Set OPENROUTER_API_KEY.'
    )
  }

  const { userId, pb, access } = await requireProjectOwner(event, id)
  checkRateLimit(rateLimitKey(userId, 'adapt-to-film-generate'), 12, 60_000)
  pruneOldJobs()

  const body = await readBody<{
    kind?: string
    sectionKey?: string
    sceneId?: string
    shotId?: string
    promptWhich?: 'image' | 'video'
    replaceTreatment?: boolean
    includeDraftScenes?: boolean
    versionMode?: 'replace' | 'new'
  }>(event)

  const kind = body?.kind as AdaptJobKind
  if (!kind || !KINDS.has(kind)) {
    throw createError({ statusCode: 400, message: 'Invalid generation kind.' })
  }

  const lockKey = adaptSubmitLockKey(userId, id, kind)
  if (!tryAcquireAdaptSubmitLock(lockKey)) {
    throw createError({
      statusCode: 409,
      message: 'A similar Adapt to Film generation is already in progress. Wait or retry shortly.'
    })
  }

  const { state } = await loadAdaptState(pb, id)
  const sourceErr = validateAdaptSourceText(state.workingSourceText || state.originalSourceText)
  if (sourceErr && kind !== 'analyze_source') {
    releaseAdaptSubmitLock(lockKey)
    throw createError({ statusCode: 400, message: sourceErr })
  }

  const job = createJob({
    userId,
    projectId: id,
    kind,
    status: 'processing',
    message: `Starting ${kind}…`
  })

  void (async () => {
    try {
      let next: AdaptToFilmState = { ...state }
      updateJob(job.jobId, { message: `Running ${kind}…` })

      if (kind === 'treatment' || kind === 'analyze_source') {
        const out = await generateFilmTreatment(next, apiKey)
        const version: AdaptTreatmentVersion = {
          id: newLocalId('trt'),
          version: (next.treatments?.length || 0) + 1,
          createdAt: new Date().toISOString(),
          approved: false,
          content: { ...emptyTreatmentContent(), ...out.treatment },
          source: 'ai'
        }
        const replace =
          body?.versionMode === 'replace' || body?.replaceTreatment === true
        let treatments = [...(next.treatments || [])]
        if (replace && treatments.length) {
          const last = treatments[treatments.length - 1]
          if (!last.approved) {
            treatments = [...treatments.slice(0, -1), { ...version, version: last.version }]
          } else {
            treatments = [...treatments, version]
          }
        } else {
          treatments = [...treatments, version]
        }
        next = {
          ...next,
          sourceBlocks: out.sourceBlocks.length ? out.sourceBlocks : next.sourceBlocks,
          longSourceWarning: out.longSourceWarning,
          treatments,
          stage: 'treatment'
        }
      } else if (kind === 'treatment_section') {
        const sectionKey = String(body?.sectionKey || '').trim()
        if (!sectionKey) throw new Error('sectionKey is required.')
        const patch = await regenerateTreatmentSection(next, sectionKey, apiKey)
        const current =
          next.treatments.find(t => t.id === next.approvedTreatmentId) ||
          next.treatments[next.treatments.length - 1]
        if (!current) throw new Error('No treatment to update. Generate a treatment first.')
        const updated: AdaptTreatmentVersion = {
          ...current,
          content: { ...current.content, ...patch },
          source: 'user'
        }
        next = {
          ...next,
          treatments: next.treatments.map(t => (t.id === current.id ? updated : t))
        }
      } else if (kind === 'scenes') {
        const out = await generateSceneBreakdown(next, apiKey)
        const locked = next.scenes.filter(s => s.locked || s.status === 'locked')
        const generated: AdaptScene[] = out.scenes.map((s, i) => ({
          ...s,
          id: newLocalId('scn'),
          sceneNumber: s.sceneNumber || i + 1,
          status: s.status || 'draft',
          locked: false
        }))
        next = {
          ...next,
          scenes: [...locked, ...generated].map((s, i) => ({ ...s, sceneNumber: i + 1 })),
          stage: 'scenes'
        }
        next = await syncAdaptScenesAndShotsToCreative(pb, id, access.ownerId || userId, next)
      } else if (kind === 'scene') {
        const sceneId = String(body?.sceneId || '')
        const scene = next.scenes.find(s => s.id === sceneId)
        if (!scene) throw new Error('Scene not found.')
        if (scene.locked || scene.status === 'locked') {
          throw new Error('This scene is locked and cannot be regenerated.')
        }
        const regenerated = await regenerateScene(next, scene, apiKey)
        next = {
          ...next,
          scenes: next.scenes.map(s =>
            s.id === sceneId ? { ...s, ...regenerated, id: s.id, creativeSceneId: s.creativeSceneId } : s
          )
        }
        next = await syncAdaptScenesAndShotsToCreative(pb, id, access.ownerId || userId, next)
      } else if (kind === 'shots') {
        const sceneId = String(body?.sceneId || '')
        const includeDraft = body?.includeDraftScenes === true
        let targets = sceneId
          ? next.scenes.filter(s => s.id === sceneId)
          : next.scenes.filter(
              s =>
                s.status === 'approved' ||
                s.status === 'locked' ||
                (includeDraft && (s.status === 'draft' || s.status === 'needs_review'))
            )
        targets = filterUnlockedScenes(targets)
        if (!targets.length) {
          throw new Error(
            sceneId
              ? 'Scene not found or locked.'
              : 'No approved unlocked scenes to generate shots for. Approve scenes first, or pass includeDraftScenes.'
          )
        }
        const lockedShots = next.shots.filter(s => s.locked || s.status === 'locked')
        const unlockedOther = next.shots.filter(
          s =>
            !(s.locked || s.status === 'locked') &&
            !targets.some(t => t.id === s.sceneId)
        )
        const generated: AdaptShot[] = []
        for (const scene of targets) {
          updateJob(job.jobId, { message: `Shots for scene ${scene.sceneNumber}…` })
          const out = await generateSceneShots(next, scene, apiKey)
          out.shots.forEach((sh, i) => {
            generated.push({
              ...sh,
              id: newLocalId('shot'),
              sceneId: scene.id,
              shotNumber: sh.shotNumber || i + 1,
              sceneNumber: scene.sceneNumber,
              status: sh.status || 'prompt_ready',
              locked: false
            })
          })
        }
        next = {
          ...next,
          shots: [...lockedShots, ...unlockedOther, ...generated],
          stage: 'shots'
        }
        next = await syncAdaptScenesAndShotsToCreative(pb, id, access.ownerId || userId, next)
      } else if (kind === 'shot') {
        const shotId = String(body?.shotId || '')
        const shot = next.shots.find(s => s.id === shotId)
        if (!shot) throw new Error('Shot not found.')
        if (shot.locked || shot.status === 'locked') {
          throw new Error('This shot is locked and cannot be regenerated.')
        }
        const scene = next.scenes.find(s => s.id === shot.sceneId)
        if (!scene) throw new Error('Parent scene not found.')
        const regenerated = await regenerateShot(next, shot, scene, apiKey)
        next = {
          ...next,
          shots: next.shots.map(s =>
            s.id === shotId ? { ...s, ...regenerated, id: s.id, sceneId: s.sceneId, creativeShotId: s.creativeShotId } : s
          )
        }
        next = await syncAdaptScenesAndShotsToCreative(pb, id, access.ownerId || userId, next)
      } else if (kind === 'shot_prompt') {
        const shotId = String(body?.shotId || '')
        const which = body?.promptWhich === 'video' ? 'video' : 'image'
        const shot = next.shots.find(s => s.id === shotId)
        if (!shot) throw new Error('Shot not found.')
        if (shot.locked || shot.status === 'locked') {
          throw new Error('This shot is locked.')
        }
        const scene = next.scenes.find(s => s.id === shot.sceneId)
        if (!scene) throw new Error('Parent scene not found.')
        const patch = await regenerateShotPrompt(next, shot, scene, which, apiKey)
        next = {
          ...next,
          shots: next.shots.map(s => (s.id === shotId ? { ...s, ...patch } : s))
        }
      } else if (kind === 'extract_characters') {
        const chars = await extractCharacters(next, apiKey)
        next = {
          ...next,
          proposedCharacters: [
            ...next.proposedCharacters.filter(c => c.approved),
            ...chars.map(c => ({ ...c, id: c.id || newLocalId('char'), approved: false }))
          ]
        }
      } else if (kind === 'extract_assets') {
        const assets = await extractAssets(next, apiKey)
        next = {
          ...next,
          proposedAssets: [
            ...next.proposedAssets.filter(a => a.approved),
            ...assets.map(a => ({ ...a, id: a.id || newLocalId('asset'), approved: false }))
          ]
        }
      }

      if (next.stage === 'production' && !next.checklist.length) {
        next = { ...next, checklist: defaultProductionChecklist(next) }
      }

      const saved = await saveAdaptState(pb, id, next)
      updateJob(job.jobId, {
        status: 'completed',
        message: 'Done',
        result: {
          adapt: saved,
          summary: computeProductionSummary(saved)
        },
        usageCharged: false
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message.slice(0, 500) : 'Generation failed.'
      updateJob(job.jobId, { status: 'failed', message })
    } finally {
      releaseAdaptSubmitLock(lockKey)
    }
  })()

  setResponseStatus(event, 202)
  return {
    jobId: job.jobId,
    status: 'processing' as const,
    kind
  }
})
