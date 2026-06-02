import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import { snapDurationToModelSupported } from '~/lib/storyboard-video-duration'
import type { ProjectAsset } from '~/types/project-asset'

export type VideoJobPostResponse = {
  async?: boolean
  jobId?: string
  status?: string
  model?: string
  videoUrl?: string
}

export type OpenRouterVideoGenerateInput = {
  prompt: string
  model: string
  aspectRatio?: '16:9' | '9:16' | '1:1'
  resolution?: '480p' | '720p' | '1080p'
  durationSeconds?: number
  frameImageUrl?: string
  supportedDurations?: number[]
  /** Rare opt-in: OpenRouter model-synthesized audio. Default false — add music on the timeline. */
  generateAudio?: boolean
}

export async function pollOpenRouterVideoJob (jobId: string): Promise<string> {
  const deadline = Date.now() + 22 * 60 * 1000
  let wait = 2200
  while (Date.now() < deadline) {
    const s = await $fetch<{
      jobId: string
      status: string
      videoUrl?: string
      message?: string
    }>('/api/generate/video/status', { query: { jobId } })
    if (s.status === 'completed' && s.videoUrl?.trim()) {
      return s.videoUrl.trim()
    }
    if (s.status === 'failed' || s.status === 'cancelled' || s.status === 'expired') {
      throw new Error((s.message || '').trim() || `Video job ${s.status}`)
    }
    await new Promise(r => setTimeout(r, wait))
    wait = Math.min(14_000, Math.floor(wait * 1.22))
  }
  throw new Error('Still rendering — try again in a bit or check OpenRouter.')
}

export async function generateOpenRouterVideo (
  input: OpenRouterVideoGenerateInput
): Promise<{ videoUrl: string; model: string; jobId?: string }> {
  const baseSec = Math.max(1, Math.floor(Number(input.durationSeconds) || 5))
  const durationSeconds =
    input.supportedDurations?.length
      ? snapDurationToModelSupported(baseSec, input.supportedDurations)
      : baseSec

  const res = await $fetch<VideoJobPostResponse>('/api/generate/video', {
    method: 'POST',
    body: {
      prompt: input.prompt.trim(),
      model: input.model,
      aspectRatio: input.aspectRatio || '16:9',
      resolution: input.resolution || '720p',
      durationSeconds,
      frameImageUrl: input.frameImageUrl?.trim() || undefined,
      generateAudio: input.generateAudio === true
    }
  })

  let url = typeof res?.videoUrl === 'string' ? res.videoUrl.trim() : ''
  if (!url && res?.async && res.jobId) {
    url = await pollOpenRouterVideoJob(res.jobId)
  }
  if (!url) {
    throw new Error('Video generation finished but no URL was returned.')
  }
  return {
    videoUrl: url,
    model: res.model || input.model,
    jobId: res.jobId
  }
}

export async function saveVideoToProjectLibrary (args: {
  projectId: string
  remoteUrl: string
  title: string
  notes?: string
  metadata?: Record<string, unknown>
  headers: Record<string, string>
}): Promise<ProjectAsset | null> {
  try {
    const res = await $fetch<{ asset?: ProjectAsset }>(
      `/api/projects/${args.projectId}/assets/ingest-from-url`,
      {
        method: 'POST',
        headers: { ...args.headers, 'Content-Type': 'application/json' },
        body: {
          url: args.remoteUrl,
          kind: 'video',
          title: args.title.slice(0, 500),
          notes: args.notes || '',
          metadata: args.metadata || {}
        }
      }
    )
    return res.asset ?? null
  } catch (e: unknown) {
    console.warn('[video] library ingest failed:', formatApiFetchError(e, 'ingest'))
    return null
  }
}

export function playbackUrlForProjectVideoAsset (projectId: string, assetId: string): string {
  return projectAssetMediaPath(projectId, assetId)
}
