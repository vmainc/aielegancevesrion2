import type { GeneratedShot, GenerateShotsContext } from '~/server/utils/generate-shots-ai'
import { applyUnifiedPromptsToShot } from '~/lib/unified-shot-prompt'

/**
 * Post-process model output: one production prompt per panel + short motion line for video.
 */
export function enrichGeneratedShotsForContinuity (
  shots: GeneratedShot[],
  ctx: GenerateShotsContext
): GeneratedShot[] {
  const cast = ctx.characters.map(c => ({
    name: c.name,
    traitsRoleVisual: c.traitsRoleVisual
  }))

  const unifiedCtx = {
    director: ctx.director,
    continuityMemory: ctx.continuityMemory || '',
    aspectRatio: ctx.aspectRatio,
    sceneTitle: ctx.sceneTitle,
    sceneSummary: ctx.sceneSummary,
    cast
  }

  return shots.map((shot, index) => {
    const asCreativeShot = {
      title: shot.title,
      description: shot.description,
      shotType: shot.shot_type,
      cameraMove: shot.camera_move,
      imagePrompt: shot.image_prompt,
      videoPrompt: shot.video_prompt,
      negativePrompt: shot.negative_prompt
    } as import('~/types/creative-shot').CreativeShot

    const panelIndex =
      typeof shot.order === 'number' && Number.isFinite(shot.order)
        ? Math.max(0, shot.order - 1)
        : index
    const applied = applyUnifiedPromptsToShot(asCreativeShot, { ...unifiedCtx, panelIndex })

    return {
      ...shot,
      image_prompt: applied.imagePrompt.slice(0, 8000),
      video_prompt: applied.videoPrompt.slice(0, 4000),
      negative_prompt: applied.negativePrompt.slice(0, 4000)
    }
  })
}
