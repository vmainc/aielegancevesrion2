import type { TimelineClipAppendInput } from '~/types/project-timeline'
import type { TimelineClipsAppendResponse } from '~/types/project-timeline'

export type TimelineAppendOutcome = 'cloud' | 'local_only' | 'unavailable'

export interface TimelineAppendResult {
  clipId: string
  outcome: TimelineAppendOutcome
  cloudError?: string
}

export function timelineAppendToast (
  outcome: TimelineAppendOutcome,
  _kind: 'video' | 'audio' = 'video'
): { message: string; type: 'success' | 'warning' | 'info' } {
  switch (outcome) {
    case 'cloud':
      return { message: 'Added to cloud timeline.', type: 'success' }
    case 'local_only':
      return { message: 'Added locally only.', type: 'warning' }
    case 'unavailable':
      return { message: 'Cloud timeline unavailable.', type: 'warning' }
    default:
      return { message: 'Added to timeline.', type: 'success' }
  }
}

export async function appendClipsToCloudTimeline (
  projectId: string,
  clips: TimelineClipAppendInput[],
  headers: Record<string, string>
): Promise<{ ok: true; data: TimelineClipsAppendResponse } | { ok: false; error: string; statusCode?: number }> {
  const pid = projectId.trim()
  if (!pid || !clips.length) {
    return { ok: false, error: 'Missing project or clips' }
  }
  try {
    const data = await $fetch<TimelineClipsAppendResponse>(`/api/projects/${pid}/timeline/clips`, {
      method: 'POST',
      headers,
      body: { clips }
    })
    return { ok: true, data }
  } catch (e: unknown) {
    const err = e as { statusCode?: number; data?: { message?: string }; message?: string }
    const statusCode = err?.statusCode
    const message =
      (typeof err?.data?.message === 'string' && err.data.message) ||
      (typeof err?.message === 'string' && err.message) ||
      'Cloud timeline append failed'
    return { ok: false, error: message, statusCode }
  }
}
