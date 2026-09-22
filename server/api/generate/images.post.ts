import { createError, getHeader, readBody, readMultipartFormData } from 'h3'
import { buildImageFinalPrompt } from '~/lib/image-generation-prompt'
import {
  EMPTY_FILM_CONTROLS,
  IMAGE_GENERATION_ALLOWED_MIME,
  IMAGE_GENERATION_CATEGORY_IDS,
  IMAGE_GENERATION_MAX_REFERENCE_BYTES,
  IMAGE_GENERATION_MAX_REFERENCES
} from '~/lib/image-generation-defaults'
import type { FilmControls, ImageGenerationCategory } from '~/types/image-generation'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { assertUserHasProjectAccess } from '~/server/utils/project-access'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { getImageModel, getImageModels } from '~/server/utils/openrouter-images-models'
import { generateImagesViaOpenRouterApi } from '~/server/utils/openrouter-generate-images-api'
import {
  persistFailedImageGeneration,
  persistImageGenerationResult,
  type ImageGenerationStoryboardTarget
} from '~/server/utils/image-generation-persist'
import { pruneOldStagedGeneratedImages } from '~/server/utils/image-generation-store'
import { resolveReferenceImageUrlForServerFetch } from '~/server/utils/resolve-pocketbase-proxied-url-for-fetch'
import { fetchReferenceImageAsDataUrl } from '~/server/utils/reference-image-data-url'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'

const CATEGORIES = new Set<ImageGenerationCategory>(IMAGE_GENERATION_CATEGORY_IDS)

function parseCategory (raw: unknown): ImageGenerationCategory {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return CATEGORIES.has(s as ImageGenerationCategory) ? (s as ImageGenerationCategory) : 'other'
}

function parseFilmControls (raw: unknown): FilmControls {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_FILM_CONTROLS }
  const o = raw as Record<string, unknown>
  const pick = (k: string) => {
    const v = o[k]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  return {
    shotSize: pick('shotSize') || pick('shot_size'),
    cameraAngle: pick('cameraAngle') || pick('camera_angle'),
    lens: pick('lens'),
    lighting: pick('lighting'),
    style: pick('style')
  }
}

function parseAdvanced (raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v))
      ? Number(v)
      : null
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    seed: num(o.seed),
    guidance: num(o.guidance),
    strength: num(o.strength),
    style: str(o.style),
    negativePrompt: str(o.negativePrompt) || str(o.negative_prompt),
    background: str(o.background),
    outputFormat: str(o.outputFormat) || str(o.output_format)
  }
}

async function readGenerateImagesBody (event: Parameters<typeof readBody>[0]): Promise<{
  prompt: string
  modelId: string
  projectId: string | null
  sceneId: string | null
  shotId: string | null
  frameRole: 'start' | 'end'
  aspectRatio: string | null
  resolution: string | null
  n: number
  category: ImageGenerationCategory
  filmControls: FilmControls
  advanced: ReturnType<typeof parseAdvanced>
  referenceDataUrls: string[]
  autoSaveAssets: boolean
}> {
  const contentType = (getHeader(event, 'content-type') || '').toLowerCase()
  const referenceDataUrls: string[] = []

  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    const fields: Record<string, string> = {}
    for (const part of parts || []) {
      if (!part.name) continue
      if (part.filename && part.name === 'references') {
        const mime = (part.type || '').toLowerCase() || 'application/octet-stream'
        if (!IMAGE_GENERATION_ALLOWED_MIME.has(mime) && !mime.startsWith('image/')) {
          throw createError({ statusCode: 400, message: 'Reference image must be JPEG, PNG, WebP, or GIF.' })
        }
        if (!part.data?.length) continue
        if (part.data.length > IMAGE_GENERATION_MAX_REFERENCE_BYTES) {
          throw createError({ statusCode: 413, message: 'Reference image is too large (max 8MB).' })
        }
        if (referenceDataUrls.length >= IMAGE_GENERATION_MAX_REFERENCES) continue
        const b64 = Buffer.from(part.data).toString('base64')
        const safeMime = IMAGE_GENERATION_ALLOWED_MIME.has(mime) ? mime : 'image/png'
        referenceDataUrls.push(`data:${safeMime};base64,${b64}`)
        continue
      }
      fields[part.name] = Buffer.isBuffer(part.data) ? part.data.toString('utf8') : String(part.data || '')
    }

    let filmControls = { ...EMPTY_FILM_CONTROLS }
    let advanced = null as ReturnType<typeof parseAdvanced>
    try {
      if (fields.filmControls) filmControls = parseFilmControls(JSON.parse(fields.filmControls))
    } catch {
      /* ignore */
    }
    try {
      if (fields.advanced) advanced = parseAdvanced(JSON.parse(fields.advanced))
    } catch {
      /* ignore */
    }

    const refUrlsRaw = fields.referenceImageUrls || fields.reference_image_urls || ''
    if (refUrlsRaw) {
      try {
        const parsed = JSON.parse(refUrlsRaw)
        if (Array.isArray(parsed)) {
          for (const u of parsed) {
            if (typeof u === 'string' && u.trim()) referenceDataUrls.push(u.trim())
          }
        }
      } catch {
        /* ignore */
      }
    }

    return {
      prompt: fields.prompt || '',
      modelId: fields.model || fields.modelId || '',
      projectId: (fields.projectId || fields.project_id || '').trim() || null,
      sceneId: (fields.sceneId || fields.scene_id || '').trim() || null,
      shotId: (fields.shotId || fields.shot_id || '').trim() || null,
      frameRole: (fields.frameRole || fields.frame_role || '').trim() === 'end' ? 'end' : 'start',
      aspectRatio: (fields.aspectRatio || fields.aspect_ratio || '').trim() || null,
      resolution: (fields.resolution || fields.quality || '').trim() || null,
      n: Math.max(1, Math.min(10, Number(fields.n || fields.imageCount || 1) || 1)),
      category: parseCategory(fields.category),
      filmControls,
      advanced,
      referenceDataUrls,
      autoSaveAssets: fields.autoSaveAssets !== 'false' && fields.auto_save_assets !== 'false'
    }
  }

  const body = (await readBody(event)) || {}
  const urls = Array.isArray(body.referenceImageUrls)
    ? body.referenceImageUrls
    : Array.isArray(body.reference_image_urls)
      ? body.reference_image_urls
      : []
  for (const u of urls) {
    if (typeof u === 'string' && u.trim()) referenceDataUrls.push(u.trim())
  }
  if (typeof body.referenceImageUrl === 'string' && body.referenceImageUrl.trim()) {
    referenceDataUrls.push(body.referenceImageUrl.trim())
  }

  const frameRoleRaw =
    typeof body.frameRole === 'string'
      ? body.frameRole
      : typeof body.frame_role === 'string'
        ? body.frame_role
        : ''

  return {
    prompt: typeof body.prompt === 'string' ? body.prompt : '',
    modelId: typeof body.model === 'string' ? body.model : typeof body.modelId === 'string' ? body.modelId : '',
    projectId:
      typeof body.projectId === 'string'
        ? body.projectId.trim() || null
        : typeof body.project_id === 'string'
          ? body.project_id.trim() || null
          : null,
    sceneId:
      typeof body.sceneId === 'string'
        ? body.sceneId.trim() || null
        : typeof body.scene_id === 'string'
          ? body.scene_id.trim() || null
          : null,
    shotId:
      typeof body.shotId === 'string'
        ? body.shotId.trim() || null
        : typeof body.shot_id === 'string'
          ? body.shot_id.trim() || null
          : null,
    frameRole: frameRoleRaw.trim() === 'end' ? 'end' : 'start',
    aspectRatio:
      typeof body.aspectRatio === 'string'
        ? body.aspectRatio.trim() || null
        : typeof body.aspect_ratio === 'string'
          ? body.aspect_ratio.trim() || null
          : null,
    resolution:
      typeof body.resolution === 'string'
        ? body.resolution.trim() || null
        : typeof body.quality === 'string'
          ? body.quality.trim() || null
          : null,
    n: Math.max(1, Math.min(10, Number(body.n ?? body.imageCount ?? 1) || 1)),
    category: parseCategory(body.category),
    filmControls: parseFilmControls(body.filmControls ?? body.film_controls),
    advanced: parseAdvanced(body.advanced ?? body.advancedSettings),
    referenceDataUrls,
    autoSaveAssets: body.autoSaveAssets !== false && body.auto_save_assets !== false
  }
}

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  checkRateLimit(rateLimitKey(userId, 'generate-images'), 10, 60_000)

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env.'
    })
  }

  void pruneOldStagedGeneratedImages()

  const input = await readGenerateImagesBody(event)
  if (!input.prompt.trim()) {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }

  if (input.projectId) {
    const pbAccess = await getAuthenticatedPocketBase()
    await assertUserHasProjectAccess(pbAccess, userId, input.projectId)
  }

  let storyboardTarget: ImageGenerationStoryboardTarget | null = null
  if (input.shotId && input.projectId) {
    if (!input.sceneId) {
      throw createError({
        statusCode: 400,
        message: 'sceneId is required when attaching a generation to a storyboard shot.'
      })
    }
    const pbShot = await getAuthenticatedPocketBase()
    try {
      const row = await pbShot.collection('creative_shots').getOne(input.shotId)
      const shot = pbRecordToCreativeShot(row as never)
      if (shot.projectId !== input.projectId) {
        throw createError({ statusCode: 403, message: 'Shot does not belong to this project.' })
      }
      if (shot.sceneId && shot.sceneId !== input.sceneId) {
        throw createError({ statusCode: 400, message: 'sceneId does not match the shot.' })
      }
      const sceneShots = await pbShot.collection('creative_shots').getFullList({
        filter: `project = "${input.projectId}" && scene = "${input.sceneId}"`,
        sort: 'sort_order',
        fields: 'id'
      })
      const panelIndex = sceneShots.findIndex((s: { id: string }) => s.id === input.shotId)
      storyboardTarget = {
        sceneId: input.sceneId,
        shotId: input.shotId,
        frameRole: input.frameRole,
        panelIndex: panelIndex >= 0 ? panelIndex : 0,
        shotTitle: shot.title,
        sortOrder: shot.sortOrder
      }
    } catch (e: unknown) {
      if ((e as { statusCode?: number })?.statusCode) throw e
      throw createError({ statusCode: 404, message: 'Storyboard shot not found.' })
    }
  }

  const category: ImageGenerationCategory = storyboardTarget
    ? 'storyboards'
    : input.category

  const { models, defaultModelId } = await getImageModels({ apiKey })
  const requested = input.modelId.trim() || defaultModelId
  let model = models.find((m) => m.id === requested) || null
  if (!model) {
    model = (await getImageModel(defaultModelId)) || models[0] || null
  }
  if (!model) {
    throw createError({
      statusCode: 503,
      message: 'No image models are available right now. Try again later.'
    })
  }

  if (input.aspectRatio && model.aspectRatios.length && !model.aspectRatios.includes(input.aspectRatio)) {
    throw createError({
      statusCode: 400,
      message: `Aspect ratio ${input.aspectRatio} is not supported by this model.`
    })
  }

  if (input.resolution && model.resolutions.length && !model.resolutions.includes(input.resolution)) {
    throw createError({
      statusCode: 400,
      message: `Resolution/quality ${input.resolution} is not supported by this model.`
    })
  }

  if (input.n > 1 && input.n > model.maxImages) {
    throw createError({
      statusCode: 400,
      message: `This model supports at most ${model.maxImages} image(s) per request.`
    })
  }

  if (input.referenceDataUrls.length && !model.supportsReferences) {
    throw createError({
      statusCode: 400,
      message: 'This model does not support reference images. Choose another model or remove references.'
    })
  }

  const { prompt, finalPrompt } = buildImageFinalPrompt(input.prompt, input.filmControls, {
    category: input.category
  })

  const internalPb = String(config.pocketbaseInternalUrl || '').trim()
  const publicPb = String(config.public?.pocketbaseUrl || '').trim()
  const resolvedRefs: string[] = []
  for (const raw of input.referenceDataUrls.slice(0, IMAGE_GENERATION_MAX_REFERENCES)) {
    try {
      if (raw.startsWith('data:')) {
        resolvedRefs.push(raw)
        continue
      }
      const resolved = await resolveReferenceImageUrlForServerFetch(raw, {
        pocketbaseInternalUrl: internalPb,
        publicPocketbaseUrl: publicPb || undefined
      })
      const dataUrl = await fetchReferenceImageAsDataUrl(resolved, 2_200_000)
      resolvedRefs.push(dataUrl)
    } catch {
      throw createError({
        statusCode: 400,
        message: 'Could not load one of the reference images. Check the file and try again.'
      })
    }
  }

  const pb = await getAuthenticatedPocketBase()
  const started = Date.now()
  const generationSettings = {
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    n: input.n,
    advanced: input.advanced,
    source: 'generate_images',
    scene_id: storyboardTarget?.sceneId || null,
    shot_id: storyboardTarget?.shotId || null,
    frame_role: storyboardTarget?.frameRole || null
  }

  try {
    const result = await generateImagesViaOpenRouterApi({
      apiKey,
      model,
      prompt: finalPrompt,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      n: storyboardTarget ? 1 : input.n,
      inputReferenceUrls: resolvedRefs,
      advanced: input.advanced
    })

    const persisted = await persistImageGenerationResult({
      pb,
      userId,
      projectId: input.projectId,
      prompt,
      finalPrompt,
      model: result.model,
      provider: model.provider || 'openrouter',
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      category,
      filmControls: input.filmControls,
      generationSettings,
      referenceImageCount: resolvedRefs.length,
      images: result.images,
      costUsd: result.costUsd,
      usage: result.usage,
      durationMs: Date.now() - started,
      autoSaveAssets: Boolean(input.projectId) && input.autoSaveAssets,
      storyboardTarget
    })

    return {
      generation: persisted.generation,
      urls: persisted.stagedUrls,
      model: result.model,
      attachedStoryboardAssetId: persisted.attachedStoryboardAssetId,
      storyboardTarget: storyboardTarget
        ? {
            projectId: input.projectId,
            sceneId: storyboardTarget.sceneId,
            shotId: storyboardTarget.shotId,
            frameRole: storyboardTarget.frameRole
          }
        : null,
      notice: persisted.collectionAvailable
        ? persisted.attachedStoryboardAssetId
          ? 'Frame attached to the storyboard panel.'
          : undefined
        : 'Generated images are ready. Run setup-db / add-fields to enable permanent generation history.'
    }
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode || 502
    const message =
      (err as { message?: string })?.message || 'Image generation failed.'
    await persistFailedImageGeneration({
      pb,
      userId,
      projectId: input.projectId,
      prompt,
      finalPrompt,
      model: model.id,
      provider: model.provider || 'openrouter',
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      category,
      filmControls: input.filmControls,
      generationSettings,
      referenceImageCount: resolvedRefs.length,
      errorMessage: message,
      durationMs: Date.now() - started
    })
    throw createError({
      statusCode: status === 200 ? 502 : status,
      message
    })
  }
})
