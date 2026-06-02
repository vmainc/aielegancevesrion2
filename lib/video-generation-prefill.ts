export type VideoGenerationAspectRatio = '16:9' | '9:16' | '1:1'

/** Payload for Tools → Video generation (from API or in-tab stash). */
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
  source?: 'project_video_panel' | 'standalone_video_tool'
}

/** In-memory handoff for same-tab navigation to Video tools. */
export function useVideoGenerationPrefillState () {
  return useState<VideoGenerationPrefill | null>('aie_video_generation_prefill', () => null)
}

export function stashVideoGenerationPanelPrefill (payload: VideoGenerationPrefill): void {
  useVideoGenerationPrefillState().value = payload
}

export function clearVideoGenerationPanelPrefill (): void {
  useVideoGenerationPrefillState().value = null
}

/** Open video tool for a storyboard panel (prefetch API payload before navigate). */
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
