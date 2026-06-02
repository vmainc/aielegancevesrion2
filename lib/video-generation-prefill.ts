export type VideoGenerationAspectRatio = '16:9' | '9:16' | '1:1'

/** Payload for Tools → Video generation (from API or legacy handoff). */
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

/** Legacy in-memory handoff (sessionStorage fallback only). */
export function useVideoGenerationPrefillState () {
  return useState<VideoGenerationPrefill | null>('aie_video_generation_prefill', () => null)
}

export function useVideoGenerationDraft () {
  return useState<VideoGenerationPrefill | null>('aie_video_generation_draft', () => null)
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

/** Legacy handoff: useState → draft → sessionStorage (?prefill=uuid). */
export function resolveVideoGenerationPrefill (prefillId?: string): VideoGenerationPrefill | null {
  const state = useVideoGenerationPrefillState().value
  if (state?.prompt?.trim()) return state
  const draft = useVideoGenerationDraft().value
  if (draft?.prompt?.trim()) return draft
  if (prefillId?.trim()) {
    const loaded = loadVideoGenerationPrefill(prefillId.trim())
    if (loaded?.prompt?.trim()) return loaded
  }
  return null
}

export function clearVideoGenerationHandoff (prefillId?: string): void {
  useVideoGenerationPrefillState().value = null
  if (prefillId?.trim()) clearVideoGenerationPrefill(prefillId.trim())
}

/** Stash panel prefill for the next visit to Tools → Video generation (same-tab navigation). */
export function stashVideoGenerationPanelPrefill (payload: VideoGenerationPrefill): void {
  useVideoGenerationPrefillState().value = payload
  useVideoGenerationDraft().value = payload
}

/** Open video tool for a storyboard panel. Pass `prefill` when already loaded (recommended). */
export async function navigateToVideoGenerationFromPanel (opts: {
  projectId: string
  sceneId: string
  shotId: string
  addToTimeline?: boolean
  prefill?: VideoGenerationPrefill
}): Promise<void> {
  if (opts.prefill?.prompt?.trim()) {
    stashVideoGenerationPanelPrefill({
      ...opts.prefill,
      projectId: opts.projectId,
      sceneId: opts.sceneId,
      shotId: opts.shotId,
      addToTimeline: opts.addToTimeline ?? opts.prefill.addToTimeline,
      saveToProject: opts.prefill.saveToProject ?? true,
      source: opts.prefill.source ?? 'project_video_panel'
    })
  }
  const query: Record<string, string> = {
    projectId: opts.projectId,
    sceneId: opts.sceneId,
    shotId: opts.shotId
  }
  if (opts.addToTimeline) query.addToTimeline = '1'
  await navigateTo({
    path: '/tools/video-generation',
    query
  })
}

/** @deprecated Prefer navigateToVideoGenerationFromPanel — kept for callers passing a full payload. */
export async function navigateToVideoGenerationTool (
  payload: VideoGenerationPrefill
): Promise<void> {
  if (
    payload.projectId &&
    payload.sceneId &&
    payload.shotId &&
    PB_ID.test(payload.projectId)
  ) {
    await navigateToVideoGenerationFromPanel({
      projectId: payload.projectId,
      sceneId: payload.sceneId,
      shotId: payload.shotId,
      addToTimeline: payload.addToTimeline
    })
    return
  }
  useVideoGenerationPrefillState().value = payload
  useVideoGenerationDraft().value = payload
  const id = saveVideoGenerationPrefill(payload)
  await navigateTo({
    path: '/tools/video-generation',
    query: { prefill: id }
  })
}
