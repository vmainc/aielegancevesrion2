import {
  modelSupportsNativeNegativePrompt,
  normalizeVideoNegativePromptForApi,
  resolveVideoNegativePassthroughParamName
} from '~/lib/video-negative-prompt'

/** OpenRouter provider slug for model-specific passthrough (negativePrompt, etc.). */
export function guessVideoProviderSlug (modelId: string): string | undefined {
  const id = modelId.trim().toLowerCase()
  if (id.startsWith('google/')) return 'google-vertex'
  if (id.startsWith('bytedance/')) return 'byteplus'
  if (id.startsWith('alibaba/')) return 'alibaba'
  if (id.startsWith('openai/')) return 'openai'
  return undefined
}

export type VideoModelPassthroughMeta = {
  allowedPassthroughParameters: string[]
  providerSlug?: string
}

export function modelAllowsNegativePromptPassthrough (meta: VideoModelPassthroughMeta | null): boolean {
  return modelSupportsNativeNegativePrompt(meta?.allowedPassthroughParameters)
}

export function buildOpenRouterVideoNegativePassthrough (
  modelId: string,
  meta: VideoModelPassthroughMeta | null,
  negativePrompt: string
): Record<string, unknown> | undefined {
  const paramName = resolveVideoNegativePassthroughParamName(meta?.allowedPassthroughParameters)
  if (!paramName) return undefined

  const neg = normalizeVideoNegativePromptForApi(negativePrompt)
  if (!neg) return undefined

  const slug = meta?.providerSlug?.trim() || guessVideoProviderSlug(modelId)
  if (!slug) return undefined

  return {
    provider: {
      options: {
        [slug]: {
          parameters: {
            [paramName]: neg
          }
        }
      }
    }
  }
}

type VideosModelsRow = {
  id?: string
  allowed_passthrough_parameters?: unknown
  provider?: unknown
  provider_slug?: unknown
}

let catalogCache: { at: number; byId: Map<string, VideoModelPassthroughMeta> } | null = null
const CATALOG_TTL_MS = 5 * 60 * 1000

function parseStringArray (raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim()).map(x => x.trim())
}

export async function loadVideoModelPassthroughMeta (modelId: string): Promise<VideoModelPassthroughMeta | null> {
  const id = modelId.trim()
  if (!id) return null

  const now = Date.now()
  if (!catalogCache || now - catalogCache.at > CATALOG_TTL_MS) {
    const byId = new Map<string, VideoModelPassthroughMeta>()
    try {
      const res = await fetch('https://openrouter.ai/api/v1/videos/models', {
        headers: { Accept: 'application/json' }
      })
      if (res.ok) {
        const json = (await res.json()) as { data?: VideosModelsRow[] }
        for (const row of json.data || []) {
          const mid = typeof row.id === 'string' ? row.id.trim() : ''
          if (!mid) continue
          const providerSlug =
            typeof row.provider_slug === 'string'
              ? row.provider_slug.trim()
              : typeof row.provider === 'string'
                ? row.provider.trim()
                : undefined
          byId.set(mid, {
            allowedPassthroughParameters: parseStringArray(row.allowed_passthrough_parameters),
            providerSlug
          })
        }
      }
    } catch {
      /* use heuristics only */
    }
    catalogCache = { at: now, byId }
  }

  const cached = catalogCache.byId.get(id)
  if (cached) return cached

  const slug = guessVideoProviderSlug(id)
  if (!slug) return null

  // Only guess negative support for providers known to expose it when catalog row is missing.
  const guessedParams =
    id.toLowerCase().startsWith('google/veo')
      ? ['negativePrompt']
      : id.toLowerCase().startsWith('alibaba/wan')
        ? ['negative_prompt']
        : []

  if (!guessedParams.length) return null

  return {
    allowedPassthroughParameters: guessedParams,
    providerSlug: slug
  }
}
