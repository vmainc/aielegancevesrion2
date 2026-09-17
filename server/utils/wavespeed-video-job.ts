import { createError } from 'h3'
import { parseVideoStartFrameRef, VIDEO_START_FRAME_PATH_PREFIX } from '~/lib/video-start-frame-ref'
import {
  WAVESPEED_GENERATE_URL,
  WAVESPEED_PREDICTION_RESULT_URL,
  WAVESPEED_SEEDANCE_25_I2V_TURBO,
  WAVESPEED_SEEDANCE_25_T2V_TURBO,
  parseWaveSpeedPrediction,
  snapWaveSpeedSeedanceDuration,
  waveSpeedPredictionIsTerminalFailure,
  waveSpeedPredictionIsTerminalSuccess,
  waveSpeedSeedanceAspectRatio,
  waveSpeedSeedanceResolution
} from '~/lib/wavespeed-video'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'
import { normalizeProviderOrigin } from '~/server/utils/video-repair-public-url'
import { getVideoRepairPublicBaseUrl } from '~/server/utils/video-repair-config'

type WaveEnvelope = Record<string, unknown>

async function readJsonOrText (res: Response): Promise<{ json: unknown | null; text: string }> {
  const text = await res.text()
  try {
    return { json: JSON.parse(text) as unknown, text }
  } catch {
    return { json: null, text }
  }
}

function waveHeaders (apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
}

function waveFailMessage (parsed: { json: unknown | null; text: string }, httpStatus: number): string {
  const pred = parsed.json ? parseWaveSpeedPrediction(parsed.json) : null
  if (pred?.message) return pred.message
  const root = parsed.json && typeof parsed.json === 'object' ? (parsed.json as WaveEnvelope) : null
  if (root && typeof root.message === 'string' && root.message.trim()) return root.message.trim()
  return parsed.text.slice(0, 800) || `WaveSpeed video request failed (HTTP ${httpStatus})`
}

function isLocalhostHost (hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1'
}

/**
 * WaveSpeed fetches image URLs itself — must be public HTTPS (not data:, not loopback).
 */
export function resolveWaveSpeedPublicImageUrl (
  url: string,
  opts: { publicPocketbaseUrl?: string; sitePublicBaseUrl?: string }
): string {
  const u = url.trim()
  if (!u) return ''
  if (u.startsWith('data:')) {
    throw createError({
      statusCode: 400,
      message:
        'WaveSpeed Seedance needs a public HTTPS start/end frame URL (inline images are not supported). Re-upload the frame and try again.'
    })
  }

  const siteOrigin = normalizeProviderOrigin(
    opts.sitePublicBaseUrl || getVideoRepairPublicBaseUrl() || ''
  )
  const pubPb = (opts.publicPocketbaseUrl || '').replace(/\/+$/, '')

  const stagedId = parseVideoStartFrameRef(u)
  if (stagedId) {
    if (!siteOrigin) {
      throw createError({
        statusCode: 500,
        message:
          'WaveSpeed needs a public site URL for start frames. Set VIDEO_REPAIR_PUBLIC_BASE_URL=https://aifilmstud.io on the server.'
      })
    }
    return `${siteOrigin}${VIDEO_START_FRAME_PATH_PREFIX}${stagedId}`
  }

  if (u.startsWith('/pb/') || u.startsWith('/api/files/')) {
    if (!pubPb) {
      throw createError({
        statusCode: 500,
        message:
          'WaveSpeed needs NUXT_PUBLIC_POCKETBASE_URL (public HTTPS) to fetch PocketBase frame images.'
      })
    }
    const path = u.startsWith('/pb/') ? u.slice('/pb'.length) : u
    return `${pubPb}${path}`
  }

  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u)
      if (isLocalhostHost(parsed.hostname)) {
        if (pubPb && parsed.pathname.startsWith('/api/files/')) {
          return `${pubPb}${parsed.pathname}${parsed.search}`
        }
        if (siteOrigin && parsed.pathname.startsWith(VIDEO_START_FRAME_PATH_PREFIX)) {
          return `${siteOrigin}${parsed.pathname}`
        }
        throw createError({
          statusCode: 400,
          message:
            'WaveSpeed cannot fetch localhost frame URLs. Use a public HTTPS frame, or set VIDEO_REPAIR_PUBLIC_BASE_URL.'
        })
      }
      if (parsed.protocol === 'http:') {
        parsed.protocol = 'https:'
        return parsed.toString()
      }
      return u
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'statusCode' in e) throw e
      throw createError({ statusCode: 400, message: 'Invalid frame image URL for WaveSpeed' })
    }
  }

  throw createError({
    statusCode: 400,
    message: `WaveSpeed needs a public HTTPS frame URL (got: ${u.slice(0, 120)})`
  })
}

export interface WaveSpeedVideoStartResult {
  jobId: string
  pollUrl: string
  model: string
  videoUrl?: string
  status: string
}

export async function startWaveSpeedVideoJob (options: {
  prompt: string
  apiKey: string
  aspectRatio?: string
  resolution?: string
  durationSeconds?: number
  firstFrameImageUrl?: string
  lastFrameImageUrl?: string
  generateAudio?: boolean
  publicPocketbaseUrl?: string
  sitePublicBaseUrl?: string
}): Promise<WaveSpeedVideoStartResult> {
  const prompt = options.prompt.trim().slice(0, 8000)
  if (!prompt) {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }

  const firstFrameRaw = options.firstFrameImageUrl?.trim() || ''
  const lastFrameRaw = options.lastFrameImageUrl?.trim() || ''
  const useI2v = Boolean(firstFrameRaw || lastFrameRaw)
  const modelPath = useI2v ? WAVESPEED_SEEDANCE_25_I2V_TURBO : WAVESPEED_SEEDANCE_25_T2V_TURBO

  const urlOpts = {
    publicPocketbaseUrl: options.publicPocketbaseUrl,
    sitePublicBaseUrl: options.sitePublicBaseUrl
  }

  const body: Record<string, unknown> = {
    prompt,
    duration: snapWaveSpeedSeedanceDuration(options.durationSeconds ?? 5),
    resolution: waveSpeedSeedanceResolution(options.resolution),
    generate_audio: options.generateAudio !== false
  }

  if (useI2v) {
    const image = resolveWaveSpeedPublicImageUrl(firstFrameRaw || lastFrameRaw, urlOpts)
    body.image = image
    if (firstFrameRaw && lastFrameRaw) {
      body.last_image = resolveWaveSpeedPublicImageUrl(lastFrameRaw, urlOpts)
    }
  } else {
    body.aspect_ratio = waveSpeedSeedanceAspectRatio(options.aspectRatio)
  }

  const created = await fetchWithTimeout(
    WAVESPEED_GENERATE_URL(modelPath),
    { method: 'POST', headers: waveHeaders(options.apiKey), body: JSON.stringify(body) },
    60_000
  )
  const createdParsed = await readJsonOrText(created)
  const pred = createdParsed.json ? parseWaveSpeedPrediction(createdParsed.json) : null
  if (!created.ok) {
    throw createError({
      statusCode: created.status === 401 ? 401 : 502,
      message: waveFailMessage(createdParsed, created.status)
    })
  }
  if (!pred?.id) {
    throw createError({ statusCode: 502, message: 'WaveSpeed did not return a prediction id' })
  }

  const pollUrl = WAVESPEED_PREDICTION_RESULT_URL(pred.id)
  if (waveSpeedPredictionIsTerminalFailure(pred.status)) {
    throw createError({
      statusCode: 502,
      message: pred.message || 'WaveSpeed video generation failed'
    })
  }
  if (waveSpeedPredictionIsTerminalSuccess(pred.status) && pred.videoUrl) {
    return {
      jobId: pred.id,
      pollUrl,
      model: modelPath,
      status: 'completed',
      videoUrl: pred.videoUrl
    }
  }

  return {
    jobId: pred.id,
    pollUrl,
    model: modelPath,
    status: pred.status || 'processing'
  }
}

export type WaveSpeedVideoPollResult =
  | { status: 'pending' | 'in_progress'; jobId: string; model: string }
  | { status: 'completed'; jobId: string; model: string; videoUrl: string }
  | { status: 'failed' | 'cancelled' | 'expired'; jobId: string; model: string; message: string }

export async function pollWaveSpeedVideoOnce (
  pollUrl: string,
  apiKey: string,
  jobId: string,
  model: string
): Promise<WaveSpeedVideoPollResult> {
  const poll = await fetchWithTimeout(
    pollUrl,
    { method: 'GET', headers: waveHeaders(apiKey) },
    60_000
  )
  const pollParsed = await readJsonOrText(poll)
  const pred = pollParsed.json ? parseWaveSpeedPrediction(pollParsed.json) : null
  if (!poll.ok) {
    throw createError({
      statusCode: 502,
      message: waveFailMessage(pollParsed, poll.status)
    })
  }
  if (!pred) {
    throw createError({ statusCode: 502, message: 'WaveSpeed poll returned an empty body' })
  }

  if (waveSpeedPredictionIsTerminalFailure(pred.status)) {
    const mapped =
      pred.status === 'cancelled' || pred.status === 'canceled'
        ? 'cancelled'
        : pred.status === 'timeout' || pred.status === 'deleted'
          ? 'expired'
          : 'failed'
    return {
      status: mapped,
      jobId: pred.id || jobId,
      model,
      message: pred.message || 'WaveSpeed video generation failed'
    }
  }

  if (waveSpeedPredictionIsTerminalSuccess(pred.status)) {
    if (!pred.videoUrl) {
      return {
        status: 'failed',
        jobId: pred.id || jobId,
        model,
        message: 'WaveSpeed finished without a video URL'
      }
    }
    return { status: 'completed', jobId: pred.id || jobId, model, videoUrl: pred.videoUrl }
  }

  const inProgress =
    pred.status === 'processing' ||
    pred.status === 'running' ||
    pred.status === 'in_progress' ||
    pred.status === 'queued' ||
    pred.status === 'created' ||
    pred.status === 'pending'
  return {
    status: inProgress ? 'in_progress' : 'pending',
    jobId: pred.id || jobId,
    model
  }
}

export async function waveSpeedGenerateVideo (options: {
  prompt: string
  apiKey: string
  aspectRatio?: string
  resolution?: string
  durationSeconds?: number
  firstFrameImageUrl?: string
  lastFrameImageUrl?: string
  generateAudio?: boolean
  publicPocketbaseUrl?: string
  sitePublicBaseUrl?: string
}): Promise<{ jobId: string; videoUrl: string; model: string; status: string }> {
  const started = await startWaveSpeedVideoJob(options)
  if (started.status === 'completed' && started.videoUrl) {
    return {
      jobId: started.jobId,
      videoUrl: started.videoUrl,
      model: started.model,
      status: 'completed'
    }
  }

  const startedPoll = Date.now()
  const maxMs = 14 * 60 * 1000
  let delayMs = 2500
  while (Date.now() - startedPoll < maxMs) {
    const r = await pollWaveSpeedVideoOnce(
      started.pollUrl,
      options.apiKey,
      started.jobId,
      started.model
    )
    if (r.status === 'completed') {
      return { jobId: r.jobId, videoUrl: r.videoUrl, model: r.model, status: r.status }
    }
    if (r.status === 'failed' || r.status === 'cancelled' || r.status === 'expired') {
      throw createError({ statusCode: 502, message: r.message })
    }
    await new Promise(res => setTimeout(res, delayMs))
    delayMs = Math.min(12_000, Math.floor(delayMs * 1.25))
  }

  throw createError({
    statusCode: 504,
    message: 'Video generation timed out while waiting for WaveSpeed. Try again.'
  })
}
