import { createError } from 'h3'
import { pollOpenRouterVideoOnce, startOpenRouterVideoJob } from '~/server/utils/openrouter-video-job'

export interface OpenRouterGenerateVideoResult {
  jobId: string
  videoUrl: string
  model: string
  status: string
}

/**
 * Text-to-video / image-to-video: submit then block until OpenRouter completes (up to ~8 min).
 * Prefer async job + client polling via `/api/generate/video` + `/api/generate/video/status` for production behind short gateway timeouts.
 */
export async function openRouterGenerateVideo (options: {
  prompt: string
  model: string
  apiKey: string
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | '9:21'
  resolution?: '480p' | '720p' | '1080p' | '1K' | '2K' | '4K'
  durationSeconds?: number
  firstFrameImageUrl?: string
}): Promise<OpenRouterGenerateVideoResult> {
  const started = await startOpenRouterVideoJob(options)
  if (started.status === 'completed' && started.videoUrl) {
    return {
      jobId: started.jobId,
      videoUrl: started.videoUrl,
      model: started.model,
      status: 'completed'
    }
  }

  const startedPoll = Date.now()
  const maxMs = 8 * 60 * 1000
  let delayMs = 1500
  while (Date.now() - startedPoll < maxMs) {
    const r = await pollOpenRouterVideoOnce(started.pollUrl, options.apiKey, started.jobId, started.model)
    if (r.status === 'completed') {
      return { jobId: r.jobId, videoUrl: r.videoUrl, model: r.model, status: r.status }
    }
    if (r.status === 'failed' || r.status === 'cancelled' || r.status === 'expired') {
      throw createError({ statusCode: 502, message: r.message })
    }
    await new Promise(res => setTimeout(res, delayMs))
    delayMs = Math.min(10_000, Math.floor(delayMs * 1.35))
  }

  throw createError({
    statusCode: 504,
    message: 'Video generation timed out while waiting for OpenRouter. Try again (or pick a faster model).'
  })
}
