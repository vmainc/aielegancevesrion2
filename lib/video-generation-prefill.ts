export type VideoGenerationAspectRatio = '16:9' | '9:16' | '1:1'

/** Payload stored in sessionStorage and opened on Tools → Video generation. */
export interface VideoGenerationPrefill {
  prompt: string
  startFrameUrl?: string | null
  aspectRatio?: VideoGenerationAspectRatio
  durationSeconds?: number
  projectId?: string
  saveToProject?: boolean
  addToTimeline?: boolean
  shotTitle?: string
  sceneId?: string
  shotId?: string
  /** Stored on saved assets when set. */
  source?: 'project_video_panel' | 'standalone_video_tool'
}

export const VIDEO_GEN_PREFILL_STORAGE_PREFIX = 'aie_video_gen_prefill:'

export function saveVideoGenerationPrefill (payload: VideoGenerationPrefill): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  if (import.meta.client) {
    sessionStorage.setItem(
      VIDEO_GEN_PREFILL_STORAGE_PREFIX + id,
      JSON.stringify(payload)
    )
  }
  return id
}

export function loadVideoGenerationPrefill (id: string): VideoGenerationPrefill | null {
  if (!import.meta.client || !id.trim()) return null
  const raw = sessionStorage.getItem(VIDEO_GEN_PREFILL_STORAGE_PREFIX + id.trim())
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as VideoGenerationPrefill
    if (!parsed || typeof parsed.prompt !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function clearVideoGenerationPrefill (id: string): void {
  if (!import.meta.client || !id.trim()) return
  sessionStorage.removeItem(VIDEO_GEN_PREFILL_STORAGE_PREFIX + id.trim())
}

export async function navigateToVideoGenerationTool (
  payload: VideoGenerationPrefill
): Promise<void> {
  const id = saveVideoGenerationPrefill(payload)
  await navigateTo({
    path: '/tools/video-generation',
    query: { prefill: id }
  })
}
