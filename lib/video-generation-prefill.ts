export type VideoGenerationAspectRatio = '16:9' | '9:16' | '1:1'

/** Payload for Tools → Video generation (from API or in-tab stash). */
export interface VideoGenerationPrefill {
  prompt: string
  startFrameUrl?: string | null
  endFrameUrl?: string | null
  aspectRatio?: VideoGenerationAspectRatio
  durationSeconds?: number
  projectId?: string
  saveToProject?: boolean
  shotTitle?: string
  sceneId?: string
  shotId?: string
  /** Cast ids used when resolving bible context for start-frame generation. */
  characterIds?: string[]
  /** Merged shot + cast avoid list — editable in Video generation; sent natively when supported. */
  negativePrompt?: string
  source?: 'project_video_panel' | 'standalone_video_tool'
  /** Read-only bible slice used when assembling prompt (debug / transparency). */
  productionBibleContext?: import('~/types/production-bible-context').ProductionBibleResolvedContext
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
  prefill?: VideoGenerationPrefill
}): Promise<void> {
  if (opts.prefill?.prompt?.trim()) {
    stashVideoGenerationPanelPrefill({
      ...opts.prefill,
      projectId: opts.projectId,
      sceneId: opts.sceneId,
      shotId: opts.shotId,
      saveToProject: opts.prefill.saveToProject ?? true,
      source: opts.prefill.source ?? 'project_video_panel'
    })
  }
  const query: Record<string, string> = {
    projectId: opts.projectId,
    sceneId: opts.sceneId,
    shotId: opts.shotId
  }
  await navigateTo({
    path: '/tools/video-generation',
    query
  })
}
