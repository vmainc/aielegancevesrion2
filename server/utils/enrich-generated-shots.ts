import type { GeneratedShot, GenerateShotsContext } from '~/server/utils/generate-shots-ai'
import {
  buildCastBibleParagraph,
  buildCharacterLockForShot,
  buildDirectorBibleBlock,
  buildProjectNegativePrompt,
  castMembersInShot,
  expandShortImagePrompt,
  isAnimalOnlyCast,
  mergeNegativePromptParts
} from '~/lib/storyboard-continuity-prompts'

const MIN_IMAGE_PROMPT_CHARS = 280
const MIN_VIDEO_PROMPT_CHARS = 140

function directorField (ctx: GenerateShotsContext, key: 'style' | 'lighting_style'): string {
  const d = ctx.director
  if (!d) return ''
  return String(d[key === 'style' ? 'style' : 'lighting_style'] || '').trim()
}

/**
 * Post-process model output: long locked prompts, cast bible injection, project negatives.
 */
export function enrichGeneratedShotsForContinuity (
  shots: GeneratedShot[],
  ctx: GenerateShotsContext
): GeneratedShot[] {
  const cast = ctx.characters.map(c => ({
    name: c.name,
    traitsRoleVisual: c.traitsRoleVisual
  }))
  const animalOnly = isAnimalOnlyCast(cast)
  const projectNegative = buildProjectNegativePrompt({ cast })
  const fullCastBible = buildCastBibleParagraph(cast)
  const directorBible = buildDirectorBibleBlock(ctx.director)
  const mem = (ctx.continuityMemory || '').trim()

  return shots.map((shot) => {
    const inShot = castMembersInShot(
      {
        title: shot.title,
        description: shot.description,
        image_prompt: shot.image_prompt
      },
      cast
    )
    const characterLock = buildCharacterLockForShot(inShot, animalOnly)

    let image_prompt = shot.image_prompt.trim()
    if (image_prompt.length < MIN_IMAGE_PROMPT_CHARS) {
      image_prompt = expandShortImagePrompt({
        title: shot.title,
        description: shot.description,
        shotType: shot.shot_type,
        cameraMove: shot.camera_move,
        sceneTitle: ctx.sceneTitle,
        sceneSummary: ctx.sceneSummary,
        directorBible,
        directorStyle: directorField(ctx, 'style'),
        directorLighting: directorField(ctx, 'lighting_style'),
        characterLock,
        existingImagePrompt: image_prompt
      })
    } else {
      if (directorBible && !image_prompt.includes('DIRECTOR BIBLE')) {
        image_prompt = `${directorBible}\n\n${image_prompt}`
      }
      if (characterLock && !image_prompt.includes('CHARACTER LOCK')) {
        image_prompt = `${image_prompt}\n\n${characterLock}`
      }
    }

    if (fullCastBible && !image_prompt.includes('FULL CAST BIBLE')) {
      image_prompt = `${image_prompt}\n\nFULL CAST BIBLE (same designs every panel):\n${fullCastBible}`
    }

    if (mem && !image_prompt.includes('CONTINUITY MEMORY')) {
      image_prompt = `${image_prompt}\n\nCONTINUITY MEMORY (do not contradict):\n${mem.slice(0, 2500)}`
    }

    if (animalOnly && !image_prompt.includes('ANIMAL-ONLY')) {
      image_prompt = `${image_prompt}\n\nANIMAL-ONLY STORY: depict only the named animal/creature cast — never add humans or human silhouettes.`
    }

    let video_prompt = shot.video_prompt.trim()
    if (video_prompt.length < MIN_VIDEO_PROMPT_CHARS) {
      video_prompt = [
        `MOTION for "${shot.title}" (${shot.camera_move}):`,
        directorBible,
        shot.description,
        characterLock,
        'Camera and subject motion only — preserve exact character designs, director bible look, and environment from the still frame.',
        image_prompt.slice(0, 1600)
      ]
        .filter(Boolean)
        .join('\n\n')
    } else if (directorBible && !video_prompt.includes('DIRECTOR BIBLE')) {
      video_prompt = `${directorBible}\n\n${video_prompt}`
    }

    const negative_prompt = mergeNegativePromptParts(
      shot.negative_prompt,
      projectNegative
    )

    return {
      ...shot,
      image_prompt: image_prompt.slice(0, 8000),
      video_prompt: video_prompt.slice(0, 8000),
      negative_prompt: negative_prompt.slice(0, 4000)
    }
  })
}
