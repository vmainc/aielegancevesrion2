import { modelSupportsNativeNegativePrompt } from '~/lib/video-negative-prompt'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

/** Hidden from the video model picker — still reachable via API if needed elsewhere. */
const EXCLUDED_OPENROUTER_VIDEO_MODEL_IDS = new Set([
  'alibaba/happyhorse-1.0',
  'alibaba/happyhorse-1.1',
  'alibaba/wan-2.6',
])

function isExcludedOpenRouterVideoModel (id: string): boolean {
  return EXCLUDED_OPENROUTER_VIDEO_MODEL_IDS.has(id.trim().toLowerCase())
}

/** Matches OpenRouter’s directory when the API is unavailable or key is missing. */
const FALLBACK_VIDEO_MODELS = [
  {
    id: 'bytedance/seedance-2.5',
    name: 'ByteDance: Seedance 2.5',
    description: 'Seedance 2.5 via OpenRouter — text/image-to-video with start/end frames.',
    provider: 'ByteDance',
    generateAudio: true,
    supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    supportedFrameImages: ['first_frame', 'last_frame'] as const,
    supportedResolutions: ['720p', '1080p'] as const,
  },
  {
    id: 'bytedance/seedance-2.0',
    name: 'ByteDance: Seedance 2.0',
    description: 'Text/image-to-video with start/end frames; clips up to 15s.',
    provider: 'ByteDance',
    generateAudio: true,
    supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    supportedFrameImages: ['first_frame', 'last_frame'] as const,
    supportedResolutions: ['720p', '1080p'] as const,
  },
  {
    id: 'bytedance/seedance-2.0-fast',
    name: 'ByteDance: Seedance 2.0 Fast',
    description: 'Faster Seedance 2.0; clips up to 15s.',
    provider: 'ByteDance',
    generateAudio: true,
    supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    supportedFrameImages: ['first_frame', 'last_frame'] as const,
    supportedResolutions: ['720p', '1080p'] as const,
  },
  {
    id: 'bytedance/seedance-1-5-pro',
    name: 'ByteDance: Seedance 1.5 Pro',
    description: 'Experimental video generation (API-only, alpha). Clips up to 12s.',
    provider: 'ByteDance',
    generateAudio: true,
    supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    supportedFrameImages: ['first_frame', 'last_frame'] as const,
    supportedResolutions: ['720p', '1080p'] as const,
  },
  {
    id: 'openai/sora-2-pro',
    name: 'OpenAI: Sora 2 Pro',
    description: 'Experimental video generation (API-only, alpha).',
    provider: 'OpenAI',
  },
  {
    id: 'google/veo-3.1',
    name: 'Google: Veo 3.1',
    description: 'Experimental video generation (API-only, alpha).',
    provider: 'Google',
    generateAudio: true,
    supportsNegativePrompt: true,
    supportedFrameImages: ['first_frame', 'last_frame'] as const,
    supportedResolutions: ['720p', '1080p'] as const,
  },
]

type VideoModelRow = {
  id: string
  name: string
  description?: string
  provider?: string
  outputModalities?: string[]
  /** From OpenRouter `GET /api/v1/videos/models` when available. */
  supportedDurations?: number[]
  /** From OpenRouter video catalog: model can emit synchronized audio. Omitted when unknown. */
  generateAudio?: boolean
  /** From OpenRouter `allowed_passthrough_parameters` — native negativePrompt when true. */
  supportsNegativePrompt?: boolean
  /** OpenRouter `supported_frame_images` — e.g. first_frame, last_frame. */
  supportedFrameImages?: Array<'first_frame' | 'last_frame'>
  /** OpenRouter `supported_resolutions` — e.g. 720p, 1080p. */
  supportedResolutions?: string[]
}

type VideosModelsPayload = {
  data?: Array<{
    id?: string
    supported_durations?: unknown
    generate_audio?: unknown
    allowed_passthrough_parameters?: unknown
    supported_frame_images?: unknown
    supported_resolutions?: unknown
  }>
}

type VideoCatalogEntry = {
  supportedDurations: number[]
  generateAudio: boolean | undefined
  allowedPassthroughParameters: string[]
  supportedFrameImages: Array<'first_frame' | 'last_frame'>
  supportedResolutions: string[]
}

function parseSupportedDurations (raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  for (const x of raw) {
    const n = typeof x === 'number' ? x : Number(x)
    if (Number.isFinite(n) && n > 0) out.push(Math.floor(n))
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

function parseGenerateAudio (raw: unknown): boolean | undefined {
  if (raw === true) return true
  if (raw === false) return false
  return undefined
}

function parseAllowedPassthrough (raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim()).map(x => x.trim())
}

function parseSupportedFrameImages (raw: unknown): Array<'first_frame' | 'last_frame'> {
  if (!Array.isArray(raw)) return []
  const out: Array<'first_frame' | 'last_frame'> = []
  for (const x of raw) {
    if (x === 'first_frame' || x === 'last_frame') out.push(x)
  }
  return [...new Set(out)]
}

function parseSupportedResolutions (raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x === 'string' && x.trim()) out.push(x.trim())
  }
  return [...new Set(out)]
}

/** OpenRouter public catalog: durations + native audio capability per model id. */
async function loadVideoCatalogById (): Promise<Map<string, VideoCatalogEntry>> {
  const map = new Map<string, VideoCatalogEntry>()
  try {
    const res = await fetch('https://openrouter.ai/api/v1/videos/models', {
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) return map
    const json = (await res.json()) as VideosModelsPayload
    for (const row of json.data || []) {
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      if (!id) continue
      map.set(id, {
        supportedDurations: parseSupportedDurations(row.supported_durations),
        generateAudio: parseGenerateAudio(row.generate_audio),
        allowedPassthroughParameters: parseAllowedPassthrough(row.allowed_passthrough_parameters),
        supportedFrameImages: parseSupportedFrameImages(row.supported_frame_images),
        supportedResolutions: parseSupportedResolutions(row.supported_resolutions)
      })
    }
  } catch {
    // leave map empty
  }
  return map
}

/** OpenRouter-only catalog. Legacy Atlas Seedance rows are no longer injected. */
function withVideoCatalog (payload: {
  source: 'api' | 'fallback'
  models: VideoModelRow[]
  notice?: string
  error?: string
}) {
  return {
    ...payload,
    atlasCloudConfigured: false
  }
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey.trim()}`
  }
  if (process.env.OPENROUTER_REFERER) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  }
  if (process.env.OPENROUTER_TITLE) {
    headers['X-Title'] = process.env.OPENROUTER_TITLE
  }

  if (!apiKey) {
    return withVideoCatalog({
      source: 'fallback',
      models: FALLBACK_VIDEO_MODELS,
      notice: 'Set OPENROUTER_API_KEY in your environment to load the live model list from OpenRouter.'
    })
  }

  const url = new URL('https://openrouter.ai/api/v1/models')
  url.searchParams.set('output_modalities', 'video')

  const res = await fetch(url.toString(), { headers })
  const rawText = await res.text()

  if (!res.ok) {
    return withVideoCatalog({
      source: 'fallback',
      models: FALLBACK_VIDEO_MODELS,
      notice: `OpenRouter returned HTTP ${res.status}. Showing reference models.`,
      error: rawText.slice(0, 200)
    })
  }

  let json: { data?: unknown[] }
  try {
    json = JSON.parse(rawText) as { data?: unknown[] }
  } catch {
    return withVideoCatalog({
      source: 'fallback',
      models: FALLBACK_VIDEO_MODELS,
      notice: 'Could not parse OpenRouter response. Showing reference models.'
    })
  }

  const rows: VideoModelRow[] = []
  for (const m of json.data || []) {
    if (!m || typeof m !== 'object') continue
    const row = m as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const name = typeof row.name === 'string' ? row.name : id
    if (!id) continue

    const desc = typeof row.description === 'string' ? row.description : ''
    const arch = row.architecture as Record<string, unknown> | undefined
    const outMods = Array.isArray(arch?.output_modalities)
      ? (arch!.output_modalities as string[]).filter((x) => typeof x === 'string')
      : undefined

    const providerFromId = id.includes('/') ? id.split('/')[0] : undefined

    rows.push({
      id,
      name,
      description: desc,
      provider: providerFromId,
      outputModalities: outMods,
    })
  }

  const visibleRows = rows.filter(row => !isExcludedOpenRouterVideoModel(row.id))

  visibleRows.sort((a, b) => a.name.localeCompare(b.name))

  const catalogById = await loadVideoCatalogById()
  for (const row of visibleRows) {
    const meta = catalogById.get(row.id)
    if (!meta) continue
    if (meta.supportedDurations.length) row.supportedDurations = meta.supportedDurations
    if (meta.generateAudio !== undefined) row.generateAudio = meta.generateAudio
    if (meta.supportedFrameImages.length) row.supportedFrameImages = meta.supportedFrameImages
    if (meta.supportedResolutions.length) row.supportedResolutions = meta.supportedResolutions
    if (modelSupportsNativeNegativePrompt(meta.allowedPassthroughParameters)) {
      row.supportsNegativePrompt = true
    } else if (row.id.toLowerCase().startsWith('google/veo')) {
      row.supportsNegativePrompt = true
    } else if (row.id.toLowerCase().startsWith('alibaba/wan')) {
      row.supportsNegativePrompt = true
    }
  }

  if (visibleRows.length === 0) {
    return withVideoCatalog({
      source: 'fallback',
      models: FALLBACK_VIDEO_MODELS.filter(m => !isExcludedOpenRouterVideoModel(m.id)),
      notice: 'No video models returned from OpenRouter. Showing reference models.'
    })
  }

  return withVideoCatalog({
    source: 'api',
    models: visibleRows
  })
})
