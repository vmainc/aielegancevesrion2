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

const PB_ID = /^[a-z0-9]{15}$/

/** In-memory handoff for same-tab navigation (more reliable than sessionStorage alone). */
export function useVideoGenerationPrefillState () {
  return useState<VideoGenerationPrefill | null>('aie_video_generation_prefill', () => null)
}

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
    try {
      localStorage.setItem(
        VIDEO_GEN_PREFILL_STORAGE_PREFIX + id,
        JSON.stringify({ savedAt: Date.now(), payload })
      )
    } catch {
      /* quota — sessionStorage is enough */
    }
  }
  return id
}

export function loadVideoGenerationPrefill (id: string): VideoGenerationPrefill | null {
  if (!import.meta.client || !id.trim()) return null
  const key = VIDEO_GEN_PREFILL_STORAGE_PREFIX + id.trim()
  const raw = sessionStorage.getItem(key)
  const parsed = parseStoredPrefill(raw)
  if (parsed) return parsed
  try {
    const localRaw = localStorage.getItem(key)
    if (!localRaw) return null
    const wrapped = JSON.parse(localRaw) as { savedAt?: number; payload?: VideoGenerationPrefill }
    if (!wrapped?.payload || typeof wrapped.savedAt !== 'number') return null
    if (Date.now() - wrapped.savedAt > 15 * 60 * 1000) {
      localStorage.removeItem(key)
      return null
    }
    return parseStoredPrefill(JSON.stringify(wrapped.payload))
  } catch {
    return null
  }
}

function parseStoredPrefill (raw: string | null): VideoGenerationPrefill | null {
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
  const key = VIDEO_GEN_PREFILL_STORAGE_PREFIX + id.trim()
  sessionStorage.removeItem(key)
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export async function navigateToVideoGenerationTool (
  payload: VideoGenerationPrefill
): Promise<void> {
  useVideoGenerationPrefillState().value = payload
  const id = saveVideoGenerationPrefill(payload)
  const query: Record<string, string> = { prefill: id }
  if (payload.projectId && PB_ID.test(payload.projectId)) {
    query.projectId = payload.projectId
  }
  await navigateTo({
    path: '/tools/video-generation',
    query
  })
}
