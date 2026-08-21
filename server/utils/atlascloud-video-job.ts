import { createError } from 'h3'
import {
  ATLAS_CLOUD_GENERATE_VIDEO_URL,
  ATLAS_CLOUD_PREDICTION_URL,
  ATLAS_SEEDANCE_25_I2V,
  atlasCloudHttpOk,
  atlasPredictionIsTerminalFailure,
  atlasPredictionIsTerminalSuccess,
  atlasSeedanceRatio,
  atlasSeedanceResolution,
  parseAtlasCloudPrediction,
  resolveAtlasSeedanceModelId,
  snapAtlasSeedanceDuration
} from '~/lib/atlas-cloud-video'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'
import { fetchImageAsDataUrlForVideo } from '~/server/utils/openrouter-video-job'

type AtlasEnvelope = Record<string, unknown>

async function readJsonOrText (res: Response): Promise<{ json: unknown | null; text: string }> {
  const text = await res.text()
  try {
    return { json: JSON.parse(text) as unknown, text }
  } catch {
    return { json: null, text }
  }
}

function atlasHeaders (apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
}

function atlasFailMessage (parsed: { json: unknown | null; text: string }, httpStatus: number): string {
  const pred = parsed.json ? parseAtlasCloudPrediction(parsed.json) : null
  if (pred?.message) return pred.message
  const root = parsed.json && typeof parsed.json === 'object' ? (parsed.json as AtlasEnvelope) : null
  if (root && typeof root.message === 'string' && root.message.trim()) return root.message.trim()
  return parsed.text.slice(0, 800) || `Atlas Cloud video request failed (HTTP ${httpStatus})`
}

export interface AtlasCloudVideoStartResult {
  jobId: string
  pollUrl: string
  model: string
  videoUrl?: string
  status: string
}

export async function startAtlasCloudVideoJob (options: {
  prompt: string
  model: string
  apiKey: string
  aspectRatio?: string
  resolution?: string
  durationSeconds?: number
  firstFrameImageUrl?: string
  lastFrameImageUrl?: string
  generateAudio?: boolean
}): Promise<AtlasCloudVideoStartResult> {
  const prompt = options.prompt.trim().slice(0, 8000)
  if (!prompt) {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }

  const firstFrame = options.firstFrameImageUrl?.trim() || ''
  const lastFrame = options.lastFrameImageUrl?.trim() || ''
  const atlasModel = resolveAtlasSeedanceModelId({
    requestedModel: options.model,
    hasFirstFrame: Boolean(firstFrame),
    hasLastFrame: Boolean(lastFrame)
  })

  if (atlasModel === ATLAS_SEEDANCE_25_I2V && !firstFrame && !lastFrame) {
    throw createError({
      statusCode: 400,
      message: 'Seedance 2.5 image-to-video needs a starting frame.'
    })
  }

  const body: Record<string, unknown> = {
    model: atlasModel,
    prompt,
    duration: snapAtlasSeedanceDuration(options.durationSeconds ?? 5),
    resolution: atlasSeedanceResolution(options.resolution),
    output_format: 'mp4',
    generate_audio: options.generateAudio === true,
    watermark: false
  }

  const ratio = atlasSeedanceRatio({
    atlasModelId: atlasModel,
    aspectRatio: options.aspectRatio
  })
  if (ratio) body.ratio = ratio

  if (atlasModel === ATLAS_SEEDANCE_25_I2V) {
    if (firstFrame) {
      body.image = await fetchImageAsDataUrlForVideo(firstFrame, 8_000_000)
    } else if (lastFrame) {
      body.image = await fetchImageAsDataUrlForVideo(lastFrame, 8_000_000)
    }
    if (firstFrame && lastFrame) {
      body.last_image = await fetchImageAsDataUrlForVideo(lastFrame, 8_000_000)
    }
  }

  const created = await fetchWithTimeout(
    ATLAS_CLOUD_GENERATE_VIDEO_URL,
    { method: 'POST', headers: atlasHeaders(options.apiKey), body: JSON.stringify(body) },
    60_000
  )
  const createdParsed = await readJsonOrText(created)
  const pred = createdParsed.json ? parseAtlasCloudPrediction(createdParsed.json) : null
  if (!created.ok || !atlasCloudHttpOk(pred?.code, created.status)) {
    throw createError({
      statusCode: created.status === 401 ? 401 : 502,
      message: atlasFailMessage(createdParsed, created.status)
    })
  }
  if (!pred?.id) {
    throw createError({ statusCode: 502, message: 'Atlas Cloud did not return a prediction id' })
  }

  const pollUrl = ATLAS_CLOUD_PREDICTION_URL(pred.id)
  if (atlasPredictionIsTerminalFailure(pred.status)) {
    throw createError({
      statusCode: 502,
      message: pred.message || 'Atlas Cloud video generation failed'
    })
  }
  if (atlasPredictionIsTerminalSuccess(pred.status) && pred.videoUrl) {
    return {
      jobId: pred.id,
      pollUrl,
      model: atlasModel,
      status: 'completed',
      videoUrl: pred.videoUrl
    }
  }

  return {
    jobId: pred.id,
    pollUrl,
    model: atlasModel,
    status: pred.status || 'processing'
  }
}

export type AtlasCloudVideoPollResult =
  | { status: 'pending' | 'in_progress'; jobId: string; model: string }
  | { status: 'completed'; jobId: string; model: string; videoUrl: string }
  | { status: 'failed' | 'cancelled' | 'expired'; jobId: string; model: string; message: string }

export async function pollAtlasCloudVideoOnce (
  pollUrl: string,
  apiKey: string,
  jobId: string,
  model: string
): Promise<AtlasCloudVideoPollResult> {
  const poll = await fetchWithTimeout(
    pollUrl,
    { method: 'GET', headers: atlasHeaders(apiKey) },
    60_000
  )
  const pollParsed = await readJsonOrText(poll)
  const pred = pollParsed.json ? parseAtlasCloudPrediction(pollParsed.json) : null
  if (!poll.ok || !atlasCloudHttpOk(pred?.code, poll.status)) {
    throw createError({
      statusCode: 502,
      message: atlasFailMessage(pollParsed, poll.status)
    })
  }
  if (!pred) {
    throw createError({ statusCode: 502, message: 'Atlas Cloud poll returned an empty body' })
  }

  if (atlasPredictionIsTerminalFailure(pred.status)) {
    const mapped =
      pred.status === 'cancelled' || pred.status === 'canceled'
        ? 'cancelled'
        : pred.status === 'expired'
          ? 'expired'
          : 'failed'
    return {
      status: mapped,
      jobId: pred.id || jobId,
      model,
      message: pred.message || 'Atlas Cloud video generation failed'
    }
  }

  if (atlasPredictionIsTerminalSuccess(pred.status)) {
    if (!pred.videoUrl) {
      return {
        status: 'failed',
        jobId: pred.id || jobId,
        model,
        message: 'Atlas Cloud finished without a video URL'
      }
    }
    return { status: 'completed', jobId: pred.id || jobId, model, videoUrl: pred.videoUrl }
  }

  const inProgress =
    pred.status === 'processing' ||
    pred.status === 'running' ||
    pred.status === 'in_progress' ||
    pred.status === 'queued'
  return {
    status: inProgress ? 'in_progress' : 'pending',
    jobId: pred.id || jobId,
    model
  }
}

export async function atlasCloudGenerateVideo (options: {
  prompt: string
  model: string
  apiKey: string
  aspectRatio?: string
  resolution?: string
  durationSeconds?: number
  firstFrameImageUrl?: string
  lastFrameImageUrl?: string
  generateAudio?: boolean
}): Promise<{ jobId: string; videoUrl: string; model: string; status: string }> {
  const started = await startAtlasCloudVideoJob(options)
  if (started.status === 'completed' && started.videoUrl) {
    return {
      jobId: started.jobId,
      videoUrl: started.videoUrl,
      model: started.model,
      status: 'completed'
    }
  }

  const startedPoll = Date.now()
  const maxMs = 12 * 60 * 1000
  let delayMs = 2500
  while (Date.now() - startedPoll < maxMs) {
    const r = await pollAtlasCloudVideoOnce(
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
    message: 'Video generation timed out while waiting for Atlas Cloud. Try again.'
  })
}
