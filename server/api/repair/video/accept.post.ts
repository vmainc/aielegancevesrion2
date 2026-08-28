import { createError, readBody } from 'h3'
import { buildGenerationObservability, GENERATION_PATH, mergeGenerationObservabilityIntoMetadata } from '~/lib/generation-observability'
import { versionLabelFromCategories } from '~/lib/video-repair/promptBuilder'
import {
  VIDEO_REPAIR_ASSET_SOURCE,
  nextShotVideoVersionNumber
} from '~/lib/video-repair/versions'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { fetchBinaryFromUrlForIngest } from '~/server/utils/fetch-url-for-project-ingest'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { readVideoRepairJob } from '~/server/utils/video-repair-job-store'
import { readVideoRepairMedia } from '~/server/utils/video-repair-media-store'
import { getVideoRepairMaxBytes } from '~/server/utils/video-repair-config'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'
import type { ProjectAsset } from '~/types/project-asset'

function str (v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const jobId = str(body.jobId)
  const projectId = str(body.projectId)
  if (!jobId) throw createError({ statusCode: 400, message: 'jobId is required.' })
  if (!projectId) throw createError({ statusCode: 400, message: 'projectId is required to accept a repair.' })

  const { pb, access } = await requireProjectOwner(event, projectId)
  const job = await readVideoRepairJob(jobId)
  if (!job || job.userId !== userId) {
    throw createError({ statusCode: 404, message: 'Repair job not found.' })
  }
  if (job.status !== 'completed' || !job.outputVideo) {
    throw createError({ statusCode: 400, message: 'This repair is not ready to accept.' })
  }
  if (job.projectId && job.projectId !== projectId) {
    throw createError({ statusCode: 403, message: 'This repair belongs to a different project.' })
  }

  let buffer: Buffer
  let filename = 'repaired.mp4'
  if (job.outputMediaId) {
    const staged = await readVideoRepairMedia(job.outputMediaId)
    if (!staged) {
      throw createError({ statusCode: 404, message: 'Repaired file expired. Download it before it is cleaned up.' })
    }
    buffer = staged.data
  } else if (/^https?:\/\//i.test(job.outputVideo)) {
    const config = useRuntimeConfig()
    const fetched = await fetchBinaryFromUrlForIngest(job.outputVideo, {
      openRouterApiKey: resolveOpenRouterApiKey(config),
      maxBytes: getVideoRepairMaxBytes(),
      timeoutMs: 180_000,
      mediaKind: 'video'
    })
    buffer = fetched.buffer
    filename = fetched.suggestedName || filename
  } else {
    throw createError({ statusCode: 400, message: 'No repaired file to save.' })
  }

  const shotId = str(body.shotId) || job.shotId || ''
  const sceneId = str(body.sceneId) || job.sceneId || ''
  const sourceAssetId = str(body.sourceAssetId) || job.sourceAssetId || ''

  let version = 2
  let originalAssetId = sourceAssetId
  const items = await listProjectAssetsForProject(pb, projectId, userId, { kind: 'video' })
  const assets: ProjectAsset[] = items.map(r => pbRecordToProjectAsset(r as Record<string, unknown>, pb))
  if (shotId) {
    version = nextShotVideoVersionNumber(assets, shotId)
    const original = assets.find(a => a.shotId === shotId || a.metadata?.shot_id === shotId)
    if (original) originalAssetId = originalAssetId || original.id
  }

  const label = versionLabelFromCategories(job.categories)
  const metadata: Record<string, unknown> = {
    source: VIDEO_REPAIR_ASSET_SOURCE,
    scene_id: sceneId || undefined,
    shot_id: shotId || undefined,
    character_id: job.characterId || undefined,
    version,
    version_label: label,
    parent_asset_id: sourceAssetId || undefined,
    original_asset_id: originalAssetId || undefined,
    is_current: body.markCurrent !== false,
    repair_categories: job.categories,
    repair_mode: job.repairMode,
    provider: job.provider,
    model: job.model,
    model_id: job.model,
    estimated_cost: job.estimatedCost,
    actual_cost: job.actualCost,
    duration_seconds: job.durationSeconds
  }

  const obs = buildGenerationObservability({
    generationPath: GENERATION_PATH.VIDEO_REPAIR,
    projectId,
    sceneId: sceneId || undefined,
    shotId: shotId || undefined,
    characterId: job.characterId,
    model: job.model,
    provider: job.provider,
    promptForHash: job.prompt,
    createdAt: new Date().toISOString()
  })
  const metadataWithObs = mergeGenerationObservabilityIntoMetadata(metadata, obs)

  const formData = new FormData()
  formData.append('owned_by', access.ownerId)
  formData.append('project', projectId)
  formData.append('kind', 'video')
  formData.append(
    'title',
    (shotId ? `v${version} ${label}` : `Repair — ${label}`).slice(0, 500)
  )
  formData.append('notes', `Fix Shot · ${label}`.slice(0, 20_000))
  formData.append('sort_order', String(version))
  formData.append('metadata', JSON.stringify(metadataWithObs))
  if (sceneId) formData.append('scene', sceneId)
  if (shotId) formData.append('shot', shotId)
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  formData.append('file', new Blob([uint8]), filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180))

  try {
    const created = await pb.collection('project_assets').create(formData)

    if (shotId && body.markCurrent !== false) {
      for (const a of assets) {
        if (a.id === String(created.id)) continue
        const sid = a.shotId || (typeof a.metadata?.shot_id === 'string' ? a.metadata.shot_id : '')
        if (sid !== shotId) continue
        if (a.metadata?.is_current !== true) continue
        try {
          await pb.collection('project_assets').update(a.id, {
            metadata: { ...(a.metadata || {}), is_current: false }
          })
        } catch (e) {
          console.warn('[video-repair] could not clear is_current on', a.id, e)
        }
      }
    }

    await syncProjectToBibleSafe({
      pb,
      userId: access.ownerId,
      projectId,
      scopes: ['assets']
    })
    return { asset: pbRecordToProjectAsset(created as Record<string, unknown>, pb) }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'project_assets collection is missing. Run: node scripts/setup-collections.js'
      })
    }
    const status = pocketBaseErrorStatus(e)
    const detail = formatPocketBaseRecordError(e)
    throw createError({
      statusCode: status && status < 500 ? status : 500,
      message: detail || 'Could not save the repaired clip.'
    })
  }
})
