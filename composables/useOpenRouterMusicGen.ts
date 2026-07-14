import { projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import type { ProjectAsset } from '~/types/project-asset'

export type MusicJobPostResponse = {
  async?: boolean
  jobId?: string
  status?: string
  model?: string
  playbackUrl?: string
  resultId?: string
  transcript?: string
}

export type OpenRouterMusicGenerateInput = {
  prompt: string
  model: string
  instrumental?: boolean
  lyrics?: string
  bpm?: number | null
  referenceImageUrl?: string
}

export async function pollOpenRouterMusicJob (jobId: string): Promise<{
  playbackUrl: string
  resultId?: string
  transcript?: string
  model?: string
}> {
  const deadline = Date.now() + 12 * 60 * 1000
  let wait = 2500
  while (Date.now() < deadline) {
    const s = await $fetch<{
      jobId: string
      status: string
      playbackUrl?: string
      resultId?: string
      transcript?: string
      model?: string
      message?: string
    }>('/api/generate/music/status', { query: { jobId } })
    if (s.status === 'completed' && s.playbackUrl?.trim()) {
      return {
        playbackUrl: s.playbackUrl.trim(),
        resultId: s.resultId,
        transcript: s.transcript,
        model: s.model
      }
    }
    if (s.status === 'failed') {
      throw new Error((s.message || '').trim() || 'Music generation failed')
    }
    await new Promise(r => setTimeout(r, wait))
    wait = Math.min(12_000, Math.floor(wait * 1.2))
  }
  throw new Error('Still composing — try again in a bit.')
}

export async function generateOpenRouterMusic (
  input: OpenRouterMusicGenerateInput
): Promise<{
  playbackUrl: string
  model: string
  jobId?: string
  resultId?: string
  transcript?: string
}> {
  const res = await $fetch<MusicJobPostResponse>('/api/generate/music', {
    method: 'POST',
    body: {
      prompt: input.prompt.trim(),
      model: input.model,
      instrumental: input.instrumental !== false,
      lyrics: input.lyrics?.trim() || '',
      bpm: input.bpm ?? null,
      referenceImageUrl: input.referenceImageUrl?.trim() || ''
    }
  })

  let url = typeof res?.playbackUrl === 'string' ? res.playbackUrl.trim() : ''
  let resultId = res.resultId
  let transcript = res.transcript
  if (!url && res?.async && res.jobId) {
    const polled = await pollOpenRouterMusicJob(res.jobId)
    url = polled.playbackUrl
    resultId = polled.resultId
    transcript = polled.transcript
  }
  if (!url) {
    throw new Error('Music generation finished but no playback URL was returned.')
  }
  return {
    playbackUrl: url,
    model: res.model || input.model,
    jobId: res.jobId,
    resultId,
    transcript
  }
}

export async function saveMusicToProjectLibrary (args: {
  projectId: string
  playbackUrl: string
  title: string
  notes?: string
  metadata?: Record<string, unknown>
  headers: Record<string, string>
}): Promise<ProjectAsset> {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : ''
  const url = args.playbackUrl.startsWith('/')
    ? `${origin}${args.playbackUrl}`
    : args.playbackUrl

  const res = await $fetch<{ asset?: ProjectAsset }>(
    `/api/projects/${args.projectId}/assets/ingest-from-url`,
    {
      method: 'POST',
      headers: { ...args.headers, 'Content-Type': 'application/json' },
      body: {
        url,
        kind: 'other',
        title: args.title.slice(0, 500),
        notes: args.notes || '',
        metadata: {
          source: 'music_generation',
          ...(args.metadata || {})
        }
      }
    }
  )
  if (!res.asset?.id) {
    throw new Error('Server did not return a saved asset.')
  }
  return res.asset
}

export function playbackUrlForProjectMusicAsset (projectId: string, assetId: string): string {
  return projectAssetMediaPath(projectId, assetId)
}
