export type VideoGenerationAspectRatio = '16:9' | '9:16' | '1:1'

export type VideoGenerationDialogueTurnPrefill = {
  speakerId?: string
  speakerName?: string
  line: string
  tone?: string
}

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
  /** Location id for set plate continuity. */
  locationId?: string
  /** Merged shot + cast avoid list — editable in Video generation; sent natively when supported. */
  negativePrompt?: string
  source?: 'project_video_panel' | 'standalone_video_tool' | 'project_generated_videos_edit'
  /**
   * When editing an existing project clip: after generate, offer Keep both / Replace.
   * Replace deletes this asset id after the new clip is saved.
   */
  replaceAssetId?: string
  /** Preferred OpenRouter model id used for this clip. */
  modelId?: string
  /** Clip resolution (720p / 1080p). */
  resolution?: string
  includeSpokenDialogue?: boolean
  includeAmbientSound?: boolean
  ambientSoundPrompt?: string
  dialogueTurns?: VideoGenerationDialogueTurnPrefill[]
  /** Older clips only stored a truncated title — warn in the form. */
  promptMayBeTruncated?: boolean
  /** Read-only bible slice used when assembling prompt (debug / transparency). */
  productionBibleContext?: import('~/types/production-bible-context').ProductionBibleResolvedContext
}

const SESSION_KEY = 'aie_video_generation_prefill_v1'

function readSessionPrefill (): VideoGenerationPrefill | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as VideoGenerationPrefill
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function writeSessionPrefill (payload: VideoGenerationPrefill | null): void {
  if (!import.meta.client) return
  try {
    if (!payload) sessionStorage.removeItem(SESSION_KEY)
    else sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Open Video tools with a saved clip's prompt / frames for re-edit. */
export async function navigateToVideoGenerationFromAsset (opts: {
  projectId: string
  prefill: VideoGenerationPrefill
}): Promise<void> {
  const replaceAssetId = (opts.prefill.replaceAssetId || '').trim()
  stashVideoGenerationPanelPrefill({
    ...opts.prefill,
    prompt: opts.prefill.prompt?.trim() || ' ',
    projectId: opts.projectId,
    saveToProject: true,
    source: opts.prefill.source || 'project_generated_videos_edit',
    replaceAssetId: replaceAssetId || undefined
  })
  const query: Record<string, string> = {
    projectId: opts.projectId,
    // Forces a remount when editing another clip (or re-editing) so stash is applied.
    editAssetId: replaceAssetId || `edit-${Date.now().toString(36)}`
  }
  await navigateTo({
    path: '/tools/video-generation',
    query
  })
}

/** In-memory handoff for same-tab navigation to Video tools. */
export function useVideoGenerationPrefillState () {
  return useState<VideoGenerationPrefill | null>('aie_video_generation_prefill', () => null)
}

export function stashVideoGenerationPanelPrefill (payload: VideoGenerationPrefill): void {
  useVideoGenerationPrefillState().value = payload
  writeSessionPrefill(payload)
}

export function clearVideoGenerationPanelPrefill (): void {
  useVideoGenerationPrefillState().value = null
  writeSessionPrefill(null)
}

/** Prefer in-memory stash; fall back to sessionStorage (survives remount / reuse). */
export function readVideoGenerationPrefill (): VideoGenerationPrefill | null {
  const fromState = useVideoGenerationPrefillState().value
  if (
    fromState?.prompt?.trim() ||
    fromState?.startFrameUrl?.trim() ||
    fromState?.endFrameUrl?.trim() ||
    fromState?.replaceAssetId?.trim()
  ) {
    return fromState
  }
  return readSessionPrefill()
}

/** Open video tool for a storyboard panel (prefetch API payload before navigate). */
export async function navigateToVideoGenerationFromPanel (opts: {
  projectId: string
  sceneId: string
  shotId: string
  prefill?: VideoGenerationPrefill
}): Promise<void> {
  if (
    opts.prefill?.prompt?.trim() ||
    opts.prefill?.startFrameUrl?.trim() ||
    opts.prefill?.endFrameUrl?.trim()
  ) {
    stashVideoGenerationPanelPrefill({
      ...opts.prefill,
      prompt: opts.prefill.prompt?.trim() || ' ',
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
