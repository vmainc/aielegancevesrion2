import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_MODEL_FALLBACKS
} from '~/lib/image-generation-defaults'
import {
  normalizeImageModel,
  pickDefaultImageModelId,
  type RawOpenRouterImageModel
} from '~/lib/normalize-image-model'
import type { ImageModel } from '~/types/image-generation'

const OPENROUTER_IMAGES_MODELS_URL = 'https://openrouter.ai/api/v1/images/models'
const CACHE_TTL_MS = 45 * 60 * 1000

type CacheEntry = {
  at: number
  models: ImageModel[]
  source: 'openrouter' | 'fallback' | 'stale'
}

let cache: CacheEntry | null = null

/** Minimal fallback catalog when OpenRouter is unreachable and no cache exists. */
export const FALLBACK_IMAGE_MODELS_RAW: RawOpenRouterImageModel[] = [
  {
    id: 'google/gemini-2.5-flash-image',
    name: 'Google: Gemini 2.5 Flash Image (Nano Banana)',
    description: 'Fast image generation.',
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
    supported_parameters: {
      aspect_ratio: {
        type: 'enum',
        values: ['1:1', '16:9', '9:16', '4:3', '3:2']
      },
      n: { type: 'integer', min: 1, max: 1 },
      input_references: { type: 'unknown' }
    }
  },
  {
    id: 'google/gemini-3.1-flash-image-preview',
    name: 'Google: Gemini 3.1 Flash Image (Nano Banana 2)',
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
    supported_parameters: {
      aspect_ratio: { type: 'enum', values: ['1:1', '16:9', '9:16'] },
      input_references: { type: 'unknown' }
    }
  },
  {
    id: 'google/gemini-3-pro-image-preview',
    name: 'Google: Gemini 3 Pro Image',
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
    supported_parameters: {
      aspect_ratio: { type: 'enum', values: ['1:1', '16:9', '9:16'] },
      input_references: { type: 'unknown' }
    }
  },
  {
    id: 'black-forest-labs/flux.2-klein-4b',
    name: 'Black Forest Labs: FLUX.2 Klein 4B',
    architecture: { input_modalities: ['text'], output_modalities: ['image'] },
    supported_parameters: {
      aspect_ratio: { type: 'enum', values: ['1:1', '16:9', '9:16', '4:3', '3:2'] }
    }
  },
  {
    id: 'black-forest-labs/flux.2-pro',
    name: 'Black Forest Labs: FLUX.2 Pro',
    architecture: { input_modalities: ['text'], output_modalities: ['image'] },
    supported_parameters: {
      aspect_ratio: { type: 'enum', values: ['1:1', '16:9', '9:16', '4:3', '3:2'] }
    }
  },
  {
    id: 'openai/gpt-5-image-mini',
    name: 'OpenAI: GPT-5 Image Mini',
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
    supported_parameters: {
      aspect_ratio: { type: 'enum', values: ['1:1', '16:9', '9:16'] },
      quality: { type: 'enum', values: ['low', 'medium', 'high', 'auto'] },
      n: { type: 'integer', min: 1, max: 4 },
      input_references: { type: 'unknown' }
    }
  },
  {
    id: 'openai/gpt-5-image',
    name: 'OpenAI: GPT-5 Image',
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
    supported_parameters: {
      aspect_ratio: { type: 'enum', values: ['1:1', '16:9', '9:16'] },
      quality: { type: 'enum', values: ['low', 'medium', 'high', 'auto'] },
      n: { type: 'integer', min: 1, max: 4 },
      input_references: { type: 'unknown' }
    }
  }
]

function openRouterHeaders (apiKey: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`
  if (process.env.OPENROUTER_REFERER) headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE
  if (!headers['X-Title']) headers['X-Title'] = 'AI Film Studio Images'
  return headers
}

function resolveConfiguredDefaultModel (): string {
  const fromEnv =
    process.env.OPENROUTER_DEFAULT_IMAGE_MODEL?.trim() ||
    process.env.NUXT_OPENROUTER_DEFAULT_IMAGE_MODEL?.trim()
  return fromEnv || DEFAULT_IMAGE_MODEL
}

function normalizeList (rows: RawOpenRouterImageModel[]): ImageModel[] {
  const models = rows
    .map((row) => normalizeImageModel(row))
    .filter((m): m is ImageModel => Boolean(m))
    .sort((a, b) => a.name.localeCompare(b.name))

  const seen = new Set(models.map((m) => m.id))
  for (const id of DEFAULT_IMAGE_MODEL_FALLBACKS) {
    if (seen.has(id)) continue
    const fb = FALLBACK_IMAGE_MODELS_RAW.find((r) => r.id === id)
    if (!fb) continue
    const normalized = normalizeImageModel(fb)
    if (normalized) {
      models.push(normalized)
      seen.add(id)
    }
  }
  models.sort((a, b) => a.name.localeCompare(b.name))
  return models
}

export async function getImageModels (options?: {
  forceRefresh?: boolean
  apiKey?: string | null
}): Promise<{
  models: ImageModel[]
  defaultModelId: string
  source: 'openrouter' | 'fallback' | 'stale'
  notice?: string
  cachedAt: number
}> {
  const now = Date.now()
  const apiKey =
    options?.apiKey !== undefined
      ? options.apiKey
      : resolveOpenRouterApiKey(useRuntimeConfig())

  if (
    !options?.forceRefresh &&
    cache &&
    now - cache.at < CACHE_TTL_MS &&
    cache.models.length
  ) {
    return {
      models: cache.models,
      defaultModelId: pickDefaultImageModelId(cache.models, resolveConfiguredDefaultModel()),
      source: cache.source,
      cachedAt: cache.at
    }
  }

  if (!apiKey?.trim()) {
    const models = normalizeList(FALLBACK_IMAGE_MODELS_RAW)
    if (!cache) {
      cache = { at: now, models, source: 'fallback' }
    }
    return {
      models: cache.models.length ? cache.models : models,
      defaultModelId: pickDefaultImageModelId(
        cache.models.length ? cache.models : models,
        resolveConfiguredDefaultModel()
      ),
      source: 'fallback',
      notice: 'Set OPENROUTER_API_KEY to load the live image model list from OpenRouter.',
      cachedAt: cache.at
    }
  }

  try {
    console.info('[image-models] fetching OpenRouter image model catalog')
    const res = await fetch(OPENROUTER_IMAGES_MODELS_URL, {
      headers: openRouterHeaders(apiKey)
    })
    const rawText = await res.text()
    if (!res.ok) {
      console.warn('[image-models] OpenRouter catalog error', { status: res.status })
      if (cache?.models.length) {
        return {
          models: cache.models,
          defaultModelId: pickDefaultImageModelId(cache.models, resolveConfiguredDefaultModel()),
          source: 'stale',
          notice: `OpenRouter models API error (${res.status}). Showing cached list.`,
          cachedAt: cache.at
        }
      }
      const models = normalizeList(FALLBACK_IMAGE_MODELS_RAW)
      cache = { at: now, models, source: 'fallback' }
      return {
        models,
        defaultModelId: pickDefaultImageModelId(models, resolveConfiguredDefaultModel()),
        source: 'fallback',
        notice: `OpenRouter models API error (${res.status}). Showing fallback list.`,
        cachedAt: now
      }
    }

    let payload: { data?: RawOpenRouterImageModel[] }
    try {
      payload = JSON.parse(rawText) as typeof payload
    } catch {
      console.warn('[image-models] failed to parse catalog JSON')
      if (cache?.models.length) {
        return {
          models: cache.models,
          defaultModelId: pickDefaultImageModelId(cache.models, resolveConfiguredDefaultModel()),
          source: 'stale',
          notice: 'Could not parse OpenRouter models response. Showing cached list.',
          cachedAt: cache.at
        }
      }
      const models = normalizeList(FALLBACK_IMAGE_MODELS_RAW)
      cache = { at: now, models, source: 'fallback' }
      return {
        models,
        defaultModelId: pickDefaultImageModelId(models, resolveConfiguredDefaultModel()),
        source: 'fallback',
        notice: 'Could not parse OpenRouter models response. Showing fallback list.',
        cachedAt: now
      }
    }

    const models = normalizeList(payload.data || [])
    if (!models.length) {
      if (cache?.models.length) {
        return {
          models: cache.models,
          defaultModelId: pickDefaultImageModelId(cache.models, resolveConfiguredDefaultModel()),
          source: 'stale',
          notice: 'OpenRouter returned an empty image catalog. Showing cached list.',
          cachedAt: cache.at
        }
      }
      const fallback = normalizeList(FALLBACK_IMAGE_MODELS_RAW)
      cache = { at: now, models: fallback, source: 'fallback' }
      return {
        models: fallback,
        defaultModelId: pickDefaultImageModelId(fallback, resolveConfiguredDefaultModel()),
        source: 'fallback',
        notice: 'OpenRouter returned an empty image catalog. Showing fallback list.',
        cachedAt: now
      }
    }

    cache = { at: now, models, source: 'openrouter' }
    console.info('[image-models] catalog refreshed', { count: models.length })
    return {
      models,
      defaultModelId: pickDefaultImageModelId(models, resolveConfiguredDefaultModel()),
      source: 'openrouter',
      cachedAt: now
    }
  } catch (err) {
    console.warn('[image-models] catalog fetch failed', {
      message: err instanceof Error ? err.message : String(err)
    })
    if (cache?.models.length) {
      return {
        models: cache.models,
        defaultModelId: pickDefaultImageModelId(cache.models, resolveConfiguredDefaultModel()),
        source: 'stale',
        notice: 'Could not refresh OpenRouter models. Showing cached list.',
        cachedAt: cache.at
      }
    }
    const models = normalizeList(FALLBACK_IMAGE_MODELS_RAW)
    cache = { at: now, models, source: 'fallback' }
    return {
      models,
      defaultModelId: pickDefaultImageModelId(models, resolveConfiguredDefaultModel()),
      source: 'fallback',
      notice: 'Could not reach OpenRouter. Showing fallback list.',
      cachedAt: now
    }
  }
}

export async function getImageModel (id: string): Promise<ImageModel | null> {
  const slug = id.trim()
  if (!slug) return null
  const { models } = await getImageModels()
  return models.find((m) => m.id === slug) || null
}

/** Test helper — clear in-memory catalog cache. */
export function clearImageModelsCacheForTests (): void {
  cache = null
}
