import { createError } from 'h3'
import {
  buildGenerationObservability,
  GENERATION_PATH
} from '~/lib/generation-observability'
import { IMAGE_GENERATION_ASSET_SOURCE } from '~/lib/image-generation-defaults'
import { resolveImageGenerationUsageCharge } from '~/lib/image-generation-credits'
import type { FilmControls, ImageGenerationCategory } from '~/types/image-generation'
import type { ProjectAssetKind } from '~/types/project-asset'
import type { StoryboardFrameRole } from '~/lib/storyboard-frame-role'
import {
  isPocketBaseMissingCollectionError,
  formatPocketBaseRecordError
} from '~/server/utils/pb-missing-collection-error'
import type { DecodedGeneratedImage } from '~/server/utils/openrouter-generate-images-api'
import {
  newImageGenerationStageId,
  saveStagedGeneratedImage,
  stagedGeneratedImagePublicPath
} from '~/server/utils/image-generation-store'
import { pbRecordToImageGeneration } from '~/server/utils/image-generation-map'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'
import { replaceStoryboardFrameAssetsForShot } from '~/server/utils/replace-storyboard-frame-assets'

function extForMime (mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  if (m.includes('webp')) return 'webp'
  if (m.includes('gif')) return 'gif'
  return 'png'
}

export type ImageGenerationStoryboardTarget = {
  sceneId: string
  shotId: string
  frameRole: StoryboardFrameRole
  panelIndex?: number
  shotTitle?: string
  sortOrder?: number
}

function kindForCategory (
  category: ImageGenerationCategory,
  storyboardTarget?: ImageGenerationStoryboardTarget | null
): ProjectAssetKind {
  if (storyboardTarget?.shotId) return 'storyboard'
  if (category === 'characters') return 'character'
  if (category === 'storyboards') return 'storyboard'
  return 'other'
}

function downloadFilename (index: number, mime: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const n = String(index + 1).padStart(3, '0')
  return `aifilmstudio-image-${date}-${n}.${extForMime(mime)}`
}

export async function persistImageGenerationResult (options: {
  pb: { collection: (name: string) => any; files: { getURL: (record: any, filename: string) => string } }
  userId: string
  projectId: string | null
  prompt: string
  finalPrompt: string
  model: string
  provider: string
  aspectRatio: string | null
  resolution: string | null
  category: ImageGenerationCategory
  filmControls: FilmControls | null
  generationSettings: Record<string, unknown>
  referenceImageCount: number
  images: DecodedGeneratedImage[]
  costUsd: number | null
  usage: Record<string, unknown> | null
  durationMs: number
  autoSaveAssets?: boolean
  storyboardTarget?: ImageGenerationStoryboardTarget | null
}): Promise<{
  generation: ReturnType<typeof pbRecordToImageGeneration>
  stagedUrls: string[]
  collectionAvailable: boolean
  attachedStoryboardAssetId: string | null
}> {
  const generationId = newImageGenerationStageId()
  const stagedUrls: string[] = []

  for (let i = 0; i < options.images.length; i++) {
    const img = options.images[i]!
    await saveStagedGeneratedImage(generationId, i, img.data, img.mime)
    stagedUrls.push(stagedGeneratedImagePublicPath(generationId, i))
  }

  const charge = resolveImageGenerationUsageCharge({
    openRouterCostUsd: options.costUsd,
    imageCount: options.images.length
  })

  const generationSettingsWithStage = {
    ...options.generationSettings,
    stage_id: generationId
  }

  const baseFields: Record<string, unknown> = {
    owned_by: options.userId,
    prompt: options.prompt.slice(0, 20_000),
    final_prompt: options.finalPrompt.slice(0, 20_000),
    model: options.model.slice(0, 200),
    provider: options.provider.slice(0, 120),
    status: 'complete',
    aspect_ratio: options.aspectRatio || '',
    resolution: options.resolution || '',
    image_count: options.images.length,
    category: options.category,
    generation_settings: generationSettingsWithStage,
    film_controls: options.filmControls || {},
    reference_image_count: options.referenceImageCount,
    cost: charge.openRouterCostUsd,
    currency: charge.openRouterCostUsd != null ? 'USD' : '',
    usage: {
      ...(options.usage || {}),
      app_credits: charge
    },
    duration_ms: options.durationMs,
    favorite: false,
    error_message: '',
    asset_ids: []
  }
  if (options.projectId) baseFields.project = options.projectId

  let collectionAvailable = true
  let record: Record<string, unknown> | null = null
  const assetIds: string[] = []
  let attachedStoryboardAssetId: string | null = null

  try {
    const formData = new FormData()
    for (const [key, value] of Object.entries(baseFields)) {
      if (value == null) continue
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value))
      } else {
        formData.append(key, String(value))
      }
    }

    for (let i = 0; i < options.images.length; i++) {
      const img = options.images[i]!
      const uint8 = new Uint8Array(img.data)
      formData.append('output_images', new Blob([uint8], { type: img.mime }), downloadFilename(i, img.mime))
    }

    record = (await options.pb.collection('image_generations').create(formData)) as Record<string, unknown>
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      collectionAvailable = false
      console.warn('[image-generate] image_generations collection missing — staged only')
    } else {
      console.error('[image-generate] failed to persist generation record', {
        message: formatPocketBaseRecordError(e)
      })
      // Still return staged images; surface soft failure via logging.
    }
  }

  const recordId = record ? String(record.id) : generationId

  // Public URLs always use the stage folder id.
  const publicUrls = stagedUrls
  const storyboardTarget = options.storyboardTarget

  if (options.autoSaveAssets !== false && options.projectId && options.images.length) {
    if (storyboardTarget?.shotId) {
      await replaceStoryboardFrameAssetsForShot({
        pb: options.pb,
        projectId: options.projectId,
        shotId: storyboardTarget.shotId,
        sceneId: storyboardTarget.sceneId,
        frameRole: storyboardTarget.frameRole
      })
    }

    // When attaching to a shot, only persist the first image as the panel frame.
    const imagesToSave =
      storyboardTarget?.shotId ? options.images.slice(0, 1) : options.images

    for (let i = 0; i < imagesToSave.length; i++) {
      const img = imagesToSave[i]!
      try {
        const observability = buildGenerationObservability({
          generationPath: storyboardTarget?.shotId
            ? GENERATION_PATH.STORYBOARD_FRAME
            : GENERATION_PATH.IMAGE_GENERATION,
          projectId: options.projectId,
          sceneId: storyboardTarget?.sceneId,
          shotId: storyboardTarget?.shotId,
          model: options.model,
          provider: options.provider || 'openrouter',
          promptForHash: options.finalPrompt
        })
        const kind = kindForCategory(options.category, storyboardTarget)
        const roleSuffix =
          storyboardTarget?.frameRole === 'end' ? ' — End' : storyboardTarget?.shotId ? ' — Start' : ''
        const titleBase =
          (storyboardTarget?.shotTitle || options.prompt.slice(0, 80) || 'Generated image').trim() ||
          'Generated image'
        const fd = new FormData()
        fd.append('owned_by', options.userId)
        fd.append('project', options.projectId)
        fd.append('kind', kind)
        fd.append('title', `${titleBase}${roleSuffix}`.slice(0, 500))
        fd.append(
          'notes',
          storyboardTarget?.shotId
            ? 'Generated via Generate → Images (storyboard frame)'
            : 'Generated via Generate → Images'
        )
        fd.append(
          'sort_order',
          String(
            storyboardTarget?.sortOrder != null && Number.isFinite(storyboardTarget.sortOrder)
              ? storyboardTarget.sortOrder
              : i + 1
          )
        )
        if (storyboardTarget?.sceneId) fd.append('scene', storyboardTarget.sceneId)
        if (storyboardTarget?.shotId) fd.append('shot', storyboardTarget.shotId)

        const metadata: Record<string, unknown> = {
          source: IMAGE_GENERATION_ASSET_SOURCE,
          category: options.category,
          generation_id: recordId,
          stage_id: generationId,
          image_index: i,
          model: options.model,
          provider: options.provider,
          aspect_ratio: options.aspectRatio,
          resolution: options.resolution,
          prompt: options.prompt.slice(0, 4000),
          final_prompt: options.finalPrompt.slice(0, 4000),
          film_controls: options.filmControls,
          generation_observability: observability
        }
        if (storyboardTarget?.shotId) {
          metadata.scene_id = storyboardTarget.sceneId
          metadata.shot_id = storyboardTarget.shotId
          metadata.frame_role = storyboardTarget.frameRole
          metadata.panel_index =
            typeof storyboardTarget.panelIndex === 'number' ? storyboardTarget.panelIndex : 0
          metadata.sort_order =
            typeof storyboardTarget.sortOrder === 'number' ? storyboardTarget.sortOrder : 0
        }

        fd.append('metadata', JSON.stringify(metadata))
        const uint8 = new Uint8Array(img.data)
        fd.append('file', new Blob([uint8], { type: img.mime }), downloadFilename(i, img.mime))
        const asset = await options.pb.collection('project_assets').create(fd)
        const assetId = String((asset as { id: string }).id)
        assetIds.push(assetId)
        if (storyboardTarget?.shotId && i === 0) {
          attachedStoryboardAssetId = assetId
        }
      } catch (err) {
        console.warn('[image-generate] asset save failed', {
          message: err instanceof Error ? err.message : String(err)
        })
      }
    }

    if (assetIds.length && record) {
      try {
        await options.pb.collection('image_generations').update(String(record.id), {
          asset_ids: assetIds
        })
        ;(record as { asset_ids?: string[] }).asset_ids = assetIds
      } catch {
        /* ignore */
      }
    }

    if (assetIds.length) {
      await syncProjectToBibleSafe({
        pb: options.pb as never,
        userId: options.userId,
        projectId: options.projectId,
        scopes: ['assets']
      })
    }
  }

  const generation = pbRecordToImageGeneration(
    record || {
      id: generationId,
      owned_by: options.userId,
      project: options.projectId,
      ...baseFields,
      generation_settings: generationSettingsWithStage,
      asset_ids: assetIds,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  )
  generation.imageUrls = publicUrls
  generation.assetIds = assetIds

  return {
    generation,
    stagedUrls: publicUrls,
    collectionAvailable,
    attachedStoryboardAssetId
  }
}

export async function persistFailedImageGeneration (options: {
  pb: { collection: (name: string) => any }
  userId: string
  projectId: string | null
  prompt: string
  finalPrompt: string
  model: string
  provider: string
  aspectRatio: string | null
  resolution: string | null
  category: ImageGenerationCategory
  filmControls: FilmControls | null
  generationSettings: Record<string, unknown>
  referenceImageCount: number
  errorMessage: string
  durationMs: number
}): Promise<void> {
  try {
    await options.pb.collection('image_generations').create({
      owned_by: options.userId,
      project: options.projectId || undefined,
      prompt: options.prompt.slice(0, 20_000),
      final_prompt: options.finalPrompt.slice(0, 20_000),
      model: options.model.slice(0, 200),
      provider: options.provider.slice(0, 120),
      status: 'failed',
      aspect_ratio: options.aspectRatio || '',
      resolution: options.resolution || '',
      image_count: 0,
      category: options.category,
      generation_settings: options.generationSettings,
      film_controls: options.filmControls || {},
      reference_image_count: options.referenceImageCount,
      error_message: options.errorMessage.slice(0, 2000),
      duration_ms: options.durationMs,
      favorite: false,
      asset_ids: []
    })
  } catch (e: unknown) {
    if (!isPocketBaseMissingCollectionError(e)) {
      console.warn('[image-generate] failed to store failed generation', {
        message: e instanceof Error ? e.message : String(e)
      })
    }
  }
}

export function requireImageGenerationId (id: string): string {
  const t = id.trim()
  if (!/^[a-z0-9]{15}$/i.test(t) && !/^[a-f0-9]{32}$/i.test(t)) {
    throw createError({ statusCode: 400, message: 'Invalid generation id' })
  }
  return t
}
