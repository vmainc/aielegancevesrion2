import { createError } from 'h3'
import { parseVideoStartFrameRef } from '~/lib/video-start-frame-ref'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'
import { readVideoStartFrame } from '~/server/utils/video-start-frame-store'

type VideoJobResponse = {
  id?: string
  polling_url?: string
  status?: string
  unsigned_urls?: string[]
  error?: unknown
}

function orOpenRouterHeaders (apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
  if (process.env.OPENROUTER_REFERER) headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE
  if (!headers['HTTP-Referer']) headers['HTTP-Referer'] = 'https://aielegance.com'
  if (!headers['X-Title']) headers['X-Title'] = 'AI Elegance Video'
  return headers
}

function jobErrorMessage (j: VideoJobResponse): string {
  const e = j.error
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m.trim()
  }
  return 'Video generation failed'
}

async function readJsonOrText (res: Response): Promise<{ json: unknown | null; text: string }> {
  const text = await res.text()
  try {
    return { json: JSON.parse(text) as unknown, text }
  } catch {
    return { json: null, text }
  }
}

export async function fetchImageAsDataUrlForVideo (imageUrl: string, maxBytes: number): Promise<string> {
  const stagedId = parseVideoStartFrameRef(imageUrl)
  if (stagedId) {
    const staged = await readVideoStartFrame(stagedId)
    if (!staged) {
      throw createError({ statusCode: 404, message: 'Starting frame not found — re-upload the image and try again.' })
    }
    if (staged.data.length > maxBytes) {
      throw createError({ statusCode: 400, message: 'Reference image is too large for video generation' })
    }
    const b64 = staged.data.toString('base64')
    return `data:${staged.mime};base64,${b64}`
  }

  if (imageUrl.trim().startsWith('data:')) {
    const raw = imageUrl.trim()
    const comma = raw.indexOf(',')
    if (comma < 0) {
      throw createError({ statusCode: 400, message: 'Invalid reference image data URL' })
    }
    const meta = raw.slice(0, comma)
    const b64 = raw.slice(comma + 1)
    const approxBytes = Math.floor((b64.length * 3) / 4)
    if (approxBytes > maxBytes) {
      throw createError({ statusCode: 400, message: 'Reference image is too large for video generation' })
    }
    const mime = meta.match(/^data:([^;]+)/i)?.[1] || 'image/jpeg'
    return `data:${mime};base64,${b64}`
  }

  const res = await fetchWithTimeout(
    imageUrl,
    { method: 'GET', headers: { Accept: 'image/*' } },
    30_000
  )
  if (!res.ok) {
    throw createError({ statusCode: 400, message: `Could not download reference image (HTTP ${res.status})` })
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > maxBytes) {
    throw createError({ statusCode: 400, message: 'Reference image is too large for video generation' })
  }
  const ct = (res.headers.get('content-type') || '').split(';')[0]?.trim() || 'image/jpeg'
  const b64 = buf.toString('base64')
  return `data:${ct};base64,${b64}`
}

export interface OpenRouterVideoStartResult {
  jobId: string
  pollUrl: string
  model: string
  /** Immediately completed (rare). */
  videoUrl?: string
  status: string
}

/**
 * Submit OpenRouter video job only (no long polling). Use {@link pollOpenRouterVideoOnce} until terminal state.
 */
export async function startOpenRouterVideoJob (options: {
  prompt: string
  model: string
  apiKey: string
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | '9:21'
  resolution?: '480p' | '720p' | '1080p' | '1K' | '2K' | '4K'
  durationSeconds?: number
  firstFrameImageUrl?: string
  /** When true, sets OpenRouter `generate_audio: true`. Defaults to false (score on timeline). */
  generateAudio?: boolean
}): Promise<OpenRouterVideoStartResult> {
  const prompt = options.prompt.trim().slice(0, 8000)
  if (!prompt) {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }
  const model = options.model.trim()
  if (!model) {
    throw createError({ statusCode: 400, message: 'Model is required' })
  }

  const apiKey = options.apiKey.trim()
  const headers = orOpenRouterHeaders(apiKey)

  const body: Record<string, unknown> = { model, prompt }
  if (options.aspectRatio) body.aspect_ratio = options.aspectRatio
  if (options.resolution) body.resolution = options.resolution
  if (typeof options.durationSeconds === 'number' && Number.isFinite(options.durationSeconds)) {
    body.duration = Math.max(1, Math.floor(options.durationSeconds))
  }

  if (options.firstFrameImageUrl) {
    const dataUrl = await fetchImageAsDataUrlForVideo(options.firstFrameImageUrl, 6_000_000)
    body.frame_images = [
      {
        type: 'image_url',
        frame_type: 'first_frame',
        image_url: { url: dataUrl }
      }
    ]
  }

  body.generate_audio = options.generateAudio === true

  const created = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/videos',
    { method: 'POST', headers, body: JSON.stringify(body) },
    60_000
  )
  const createdParsed = await readJsonOrText(created)
  if (!created.ok) {
    const msg =
      (createdParsed.json &&
        typeof createdParsed.json === 'object' &&
        'error' in createdParsed.json &&
        typeof (createdParsed.json as { error?: { message?: string } }).error?.message === 'string' &&
        (createdParsed.json as { error?: { message?: string } }).error?.message) ||
      createdParsed.text.slice(0, 800) ||
      `OpenRouter video create failed (HTTP ${created.status})`
    throw createError({ statusCode: created.status === 401 ? 401 : 502, message: msg })
  }

  const createdJson = (createdParsed.json || {}) as VideoJobResponse
  const jobId = String(createdJson.id || '').trim()
  const pollUrl =
    String(createdJson.polling_url || '').trim() ||
    `https://openrouter.ai/api/v1/videos/${encodeURIComponent(jobId)}`
  if (!jobId) {
    throw createError({ statusCode: 502, message: 'OpenRouter did not return a video job id' })
  }

  const initialStatus = String(createdJson.status || '').trim()
  if (initialStatus === 'completed') {
    const u0 = Array.isArray(createdJson.unsigned_urls) ? String(createdJson.unsigned_urls[0] || '').trim() : ''
    const videoUrl =
      u0 || `https://openrouter.ai/api/v1/videos/${encodeURIComponent(jobId)}/content?index=0`
    return { jobId, pollUrl, model, status: 'completed', videoUrl }
  }
  if (initialStatus === 'failed' || initialStatus === 'cancelled' || initialStatus === 'expired') {
    throw createError({ statusCode: 502, message: jobErrorMessage(createdJson) })
  }

  return { jobId, pollUrl, model, status: initialStatus || 'pending' }
}

export type OpenRouterVideoPollResult =
  | { status: 'pending' | 'in_progress'; jobId: string; model: string }
  | { status: 'completed'; jobId: string; model: string; videoUrl: string }
  | { status: 'failed' | 'cancelled' | 'expired'; jobId: string; model: string; message: string }

export async function pollOpenRouterVideoOnce (
  pollUrl: string,
  apiKey: string,
  jobId: string,
  model: string
): Promise<OpenRouterVideoPollResult> {
  const headers = orOpenRouterHeaders(apiKey)
  const poll = await fetchWithTimeout(pollUrl, { method: 'GET', headers }, 60_000)
  const pollParsed = await readJsonOrText(poll)
  if (!poll.ok) {
    const msg = pollParsed.text.slice(0, 800) || `OpenRouter video poll failed (HTTP ${poll.status})`
    throw createError({ statusCode: 502, message: msg })
  }
  const j = (pollParsed.json || {}) as VideoJobResponse
  const status = String(j.status || '').trim() || 'pending'
  if (status === 'failed' || status === 'cancelled' || status === 'expired') {
    return { status, jobId, model, message: jobErrorMessage(j) }
  }
  if (status === 'completed') {
    const u0 = Array.isArray(j.unsigned_urls) ? String(j.unsigned_urls[0] || '').trim() : ''
    const videoUrl =
      u0 || `https://openrouter.ai/api/v1/videos/${encodeURIComponent(jobId)}/content?index=0`
    return { status: 'completed', jobId, model, videoUrl }
  }
  return { status: status === 'in_progress' ? 'in_progress' : 'pending', jobId, model }
}
