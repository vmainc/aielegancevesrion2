/** Atlas Cloud video (Seedance 2.5). Client + server — no secrets. */

export const ATLAS_CLOUD_GENERATE_VIDEO_URL =
  'https://api.atlascloud.ai/api/v1/model/generateVideo'

export const ATLAS_CLOUD_PREDICTION_URL = (predictionId: string): string =>
  `https://api.atlascloud.ai/api/v1/model/prediction/${encodeURIComponent(predictionId)}`

/** Picker / API id — routed to Atlas, not OpenRouter. */
export const ATLAS_SEEDANCE_25_PICKER_ID = 'atlas/bytedance/seedance-2.5'

export const ATLAS_SEEDANCE_25_T2V = 'bytedance/seedance-2.5/text-to-video'
export const ATLAS_SEEDANCE_25_I2V = 'bytedance/seedance-2.5/image-to-video'
export const ATLAS_SEEDANCE_25_R2V = 'bytedance/seedance-2.5/reference-to-video'

/** Native Seedance 2.5 lengths (seconds). `-1` (auto) is not offered in the UI. */
export const ATLAS_SEEDANCE_25_DURATIONS: number[] = Array.from(
  { length: 27 },
  (_, i) => i + 4
)

export const ATLAS_SEEDANCE_25_RESOLUTIONS = ['720p', '1080p'] as const

export const ATLAS_SEEDANCE_25_VIDEO_MODEL = {
  id: ATLAS_SEEDANCE_25_PICKER_ID,
  name: 'ByteDance: Seedance 2.5 (Atlas Cloud)',
  description:
    'Up to 30s native video with synchronized audio. Text, start frame, or start + end frames. 720p and 1080p.',
  provider: 'Atlas Cloud',
  generateAudio: true,
  supportedDurations: ATLAS_SEEDANCE_25_DURATIONS,
  supportedFrameImages: ['first_frame', 'last_frame'] as const,
  supportedResolutions: [...ATLAS_SEEDANCE_25_RESOLUTIONS]
}

export function isAtlasCloudVideoModel (id: string): boolean {
  const s = id.trim().toLowerCase()
  if (!s) return false
  if (s === ATLAS_SEEDANCE_25_PICKER_ID.toLowerCase()) return true
  if (s.startsWith('atlas/')) return true
  // Native Atlas endpoint ids — not the OpenRouter listing `bytedance/seedance-2.5`.
  return (
    s === ATLAS_SEEDANCE_25_T2V ||
    s === ATLAS_SEEDANCE_25_I2V ||
    s === ATLAS_SEEDANCE_25_R2V
  )
}

/** OpenRouter catalog id for Seedance 2.5. */
export function isOpenRouterSeedance25Listing (id: string): boolean {
  return id.trim().toLowerCase() === 'bytedance/seedance-2.5'
}

/** Any Seedance 2.5 picker / API id (legacy Atlas ids or OpenRouter listing). */
export function isSeedance25ModelId (id: string): boolean {
  const s = id.trim().toLowerCase()
  return isAtlasCloudVideoModel(s) || s.startsWith('bytedance/seedance-2.5')
}

/**
 * Map legacy Atlas Seedance picker/endpoint ids to the OpenRouter catalog id.
 * New video jobs always go through OpenRouter.
 */
export function normalizeVideoModelToOpenRouter (id: string): string {
  const s = id.trim()
  if (!s) return s
  if (isSeedance25ModelId(s)) return 'bytedance/seedance-2.5'
  if (s.toLowerCase().startsWith('atlas/')) {
    return s.slice('atlas/'.length)
  }
  return s
}

export function resolveAtlasSeedanceModelId (opts: {
  requestedModel: string
  hasFirstFrame: boolean
  hasLastFrame: boolean
}): string {
  const s = opts.requestedModel.trim().toLowerCase()
  if (s.endsWith('/text-to-video')) return ATLAS_SEEDANCE_25_T2V
  if (s.endsWith('/image-to-video')) return ATLAS_SEEDANCE_25_I2V
  if (s.endsWith('/reference-to-video')) return ATLAS_SEEDANCE_25_R2V
  if (opts.hasFirstFrame || opts.hasLastFrame) return ATLAS_SEEDANCE_25_I2V
  return ATLAS_SEEDANCE_25_T2V
}

export function snapAtlasSeedanceDuration (seconds: number): number {
  const n = Math.floor(Number(seconds))
  if (!Number.isFinite(n)) return 5
  return Math.min(30, Math.max(4, n))
}

export function atlasSeedanceResolution (
  requested: string | undefined
): '480p' | '720p' | '1080p' {
  const s = String(requested || '').trim().toLowerCase()
  if (s === '480p' || s === '720p' || s === '1080p') return s
  if (s === '4k' || s === '2k' || s === '1k') return '1080p'
  return '720p'
}

const ATLAS_T2V_RATIOS = new Set(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'])

/** Text-to-video accepts explicit ratios. Image-to-video is adaptive only. */
export function atlasSeedanceRatio (opts: {
  atlasModelId: string
  aspectRatio?: string
}): string | undefined {
  if (opts.atlasModelId === ATLAS_SEEDANCE_25_I2V) return 'adaptive'
  const raw = String(opts.aspectRatio || '').trim()
  if (!raw) return '16:9'
  if (raw === '9:21') return '9:16'
  if (ATLAS_T2V_RATIOS.has(raw)) return raw
  return '16:9'
}

function asRecord (v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function firstOutputUrl (outputs: unknown): string {
  if (typeof outputs === 'string' && /^https?:\/\//i.test(outputs.trim())) return outputs.trim()
  if (!Array.isArray(outputs) || !outputs.length) return ''
  const first = outputs[0]
  if (typeof first === 'string' && /^https?:\/\//i.test(first.trim())) return first.trim()
  const rec = asRecord(first)
  if (!rec) return ''
  for (const key of ['url', 'video_url', 'uri', 'href']) {
    const v = rec[key]
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim()
  }
  return ''
}

function atlasErrorMessage (data: Record<string, unknown>, fallback: string): string {
  const err = data.error
  if (typeof err === 'string' && err.trim()) return err.trim()
  const rec = asRecord(err)
  if (rec) {
    const m = rec.message
    if (typeof m === 'string' && m.trim()) return m.trim()
  }
  for (const key of ['error_message', 'message', 'msg']) {
    const v = data[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return fallback
}

export type AtlasCloudPrediction = {
  id: string
  status: string
  videoUrl: string
  message: string
  code?: number
}

/**
 * Normalize Atlas `{ code, data }` envelopes (submit + poll).
 */
export function parseAtlasCloudPrediction (json: unknown): AtlasCloudPrediction {
  const root = asRecord(json) || {}
  const codeRaw = root.code
  const code =
    typeof codeRaw === 'number'
      ? codeRaw
      : typeof codeRaw === 'string' && /^\d+$/.test(codeRaw.trim())
        ? Number(codeRaw.trim())
        : undefined

  const data = asRecord(root.data) || (asRecord(root.id) ? root : {})
  const id = String(data.id || root.id || '').trim()
  const status = String(data.status || root.status || '').trim().toLowerCase()
  const videoUrl =
    firstOutputUrl(data.outputs) ||
    firstOutputUrl(root.outputs) ||
    (typeof data.output === 'string' ? firstOutputUrl([data.output]) : firstOutputUrl(data.output)) ||
    (typeof data.video_url === 'string' ? data.video_url.trim() : '') ||
    (typeof root.video_url === 'string' ? root.video_url.trim() : '')

  const message = atlasErrorMessage(data, atlasErrorMessage(root, ''))

  return { id, status, videoUrl, message, code }
}

export function atlasCloudHttpOk (code: number | undefined, httpStatus: number): boolean {
  if (httpStatus >= 400) return false
  if (code == null) return httpStatus >= 200 && httpStatus < 300
  return code === 0 || code === 200
}

export function atlasPredictionIsTerminalSuccess (status: string): boolean {
  const s = status.trim().toLowerCase()
  return s === 'completed' || s === 'succeeded' || s === 'success'
}

export function atlasPredictionIsTerminalFailure (status: string): boolean {
  const s = status.trim().toLowerCase()
  return s === 'failed' || s === 'error' || s === 'cancelled' || s === 'canceled' || s === 'expired'
}
