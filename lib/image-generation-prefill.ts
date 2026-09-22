import type { FilmControls, ImageGenerationCategory } from '~/types/image-generation'
import type { StoryboardFrameRole } from '~/lib/storyboard-frame-role'
import { filmControlsFromShot, imagePromptFromShot } from '~/lib/shot-to-film-controls'
import type { CreativeShot } from '~/types/creative-shot'

/** Same-tab / query handoff into Generate → Images. */
export type ImageGenerationPrefill = {
  prompt?: string
  projectId?: string
  sceneId?: string
  shotId?: string
  /** Attach result as this storyboard frame role. */
  frameRole?: StoryboardFrameRole
  aspectRatio?: string
  category?: ImageGenerationCategory
  filmControls?: FilmControls | null
  modelId?: string
  /** After generate, navigate back here (e.g. `/projects/:id/storyboard`). */
  returnTo?: string
  source?: 'storyboard_panel' | 'standalone' | 'video_tool'
}

export function useImageGenerationPrefillState () {
  return useState<ImageGenerationPrefill | null>('aie_image_generation_prefill', () => null)
}

export function stashImageGenerationPrefill (payload: ImageGenerationPrefill): void {
  useImageGenerationPrefillState().value = payload
}

export function clearImageGenerationPrefill (): void {
  useImageGenerationPrefillState().value = null
}

export function takeImageGenerationPrefill (): ImageGenerationPrefill | null {
  const state = useImageGenerationPrefillState()
  const payload = state.value
  state.value = null
  return payload
}

/** Build query params for `/tools/image-generation`. */
export function imageGenerationQueryFromPrefill (
  prefill: ImageGenerationPrefill
): Record<string, string> {
  const q: Record<string, string> = {}
  if (prefill.projectId) q.projectId = prefill.projectId
  if (prefill.sceneId) q.sceneId = prefill.sceneId
  if (prefill.shotId) q.shotId = prefill.shotId
  if (prefill.frameRole === 'end') q.frameRole = 'end'
  if (prefill.aspectRatio) q.aspectRatio = prefill.aspectRatio
  if (prefill.category) q.category = prefill.category
  if (prefill.returnTo) q.returnTo = prefill.returnTo
  if (prefill.source) q.source = prefill.source
  return q
}

/**
 * Open Generate → Images with storyboard shot context.
 * Stashes prompt + film controls; URL carries ids for reload-safe write-back.
 */
export async function navigateToImageGenerationFromShot (opts: {
  projectId: string
  sceneId: string
  shot: CreativeShot
  frameRole?: StoryboardFrameRole
  aspectRatio?: string
  returnTo?: string
}): Promise<void> {
  const frameRole = opts.frameRole || 'start'
  const prompt = imagePromptFromShot(opts.shot)
  const filmControls = filmControlsFromShot(opts.shot)
  const returnTo =
    opts.returnTo || `/projects/${opts.projectId}/storyboard`

  const prefill: ImageGenerationPrefill = {
    prompt,
    projectId: opts.projectId,
    sceneId: opts.sceneId,
    shotId: opts.shot.id,
    frameRole,
    aspectRatio: opts.aspectRatio || '16:9',
    category: 'storyboards',
    filmControls,
    returnTo,
    source: 'storyboard_panel'
  }

  stashImageGenerationPrefill(prefill)

  await navigateTo({
    path: '/tools/image-generation',
    query: imageGenerationQueryFromPrefill(prefill)
  })
}

export function parseImageGenerationQuery (
  query: Record<string, unknown>
): ImageGenerationPrefill {
  const str = (k: string) => {
    const v = query[k]
    return typeof v === 'string' ? v.trim() : ''
  }
  const frameRoleRaw = str('frameRole') || str('frame_role')
  const categoryRaw = str('category')
  const categories = new Set([
    'characters',
    'locations',
    'storyboards',
    'props',
    'concept_art',
    'logos',
    'titles',
    'graphics',
    'other'
  ])
  return {
    projectId: str('projectId') || str('project') || undefined,
    sceneId: str('sceneId') || str('scene_id') || undefined,
    shotId: str('shotId') || str('shot_id') || undefined,
    frameRole: frameRoleRaw === 'end' ? 'end' : frameRoleRaw === 'start' ? 'start' : undefined,
    aspectRatio: str('aspectRatio') || str('aspect_ratio') || undefined,
    category: categories.has(categoryRaw)
      ? (categoryRaw as ImageGenerationCategory)
      : undefined,
    returnTo: str('returnTo') || str('return_to') || undefined,
    source:
      str('source') === 'storyboard_panel'
        ? 'storyboard_panel'
        : str('source') === 'video_tool'
          ? 'video_tool'
          : undefined
  }
}
