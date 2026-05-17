import {
  buildCastBibleParagraph,
  buildCharacterLockForShot,
  buildDirectorBibleBlock,
  buildProjectNegativePrompt,
  castMembersInShot,
  formatNegativePromptForImageModel,
  isAnimalOnlyCast,
  mergeNegativePromptParts,
  trimPromptForImageModel
} from '~/lib/storyboard-continuity-prompts'
import { parseProjectAspectRatio, SINGLE_STORYBOARD_FRAME_DIRECTIVE } from '~/lib/storyboard-frame-image'
import type { ProjectDirector } from '~/types/creative-project'
import type { CreativeShot } from '~/types/creative-shot'

export interface UnifiedShotPromptContext {
  director?: ProjectDirector | null
  continuityMemory?: string
  aspectRatio?: string
  sceneTitle?: string
  sceneSummary?: string
  cast: Array<{ name: string; traitsRoleVisual: string }>
}

const UNIFIED_MARKERS =
  /DIRECTOR BIBLE|FULL CAST BIBLE|STILL FRAME FOR THIS PANEL|STRICT EXCLUSIONS/i

export function promptLooksUnified (text: string): boolean {
  const t = text.trim()
  return t.length >= 280 && UNIFIED_MARKERS.test(t)
}

function dedupeJoinBlocks (...blocks: (string | undefined)[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of blocks) {
    const b = (raw || '').trim()
    if (!b) continue
    const key = b.slice(0, 120).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(b)
  }
  return out.join('\n\n')
}

/** Merge split legacy fields into one production prompt for display / generation. */
export function mergeLegacyShotPromptsToUnified (shot: CreativeShot): string {
  const img = shot.imagePrompt.trim()
  if (promptLooksUnified(img)) return img

  const vid = shot.videoPrompt.trim()
  const neg = shot.negativePrompt.trim()
  const parts = [img]
  if (vid && !img.includes(vid.slice(0, 80))) parts.push(vid)
  if (neg) {
    const negBlock = formatNegativePromptForImageModel(
      mergeNegativePromptParts(neg, buildProjectNegativePrompt({
        cast: []
      }))
    )
    if (negBlock && !img.includes('STRICT EXCLUSIONS')) parts.push(negBlock)
  }
  return dedupeJoinBlocks(...parts)
}

export function buildMotionPromptForShot (shot: Pick<CreativeShot, 'title' | 'description' | 'cameraMove' | 'videoPrompt'>): string {
  const vid = (shot.videoPrompt || '').trim()
  if (vid && !promptLooksUnified(vid) && !/DIRECTOR BIBLE|FULL CAST BIBLE/i.test(vid)) {
    return vid
  }
  const motion = (shot.description || '').trim()
  const camera = (shot.cameraMove || 'subtle movement').trim()
  const title = (shot.title || 'Shot').trim()
  return [
    `VIDEO MOTION — "${title}" · camera: ${camera}`,
    motion,
    'Animate only this beat. Preserve character designs, wardrobe, environment, and lighting from the production prompt still frame.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * One production prompt: director, continuity, cast, scene, panel beat, exclusions.
 * Stored in `imagePrompt`; used for frame generation and as base for video.
 */
export function buildUnifiedProductionPrompt (
  shot: Pick<
    CreativeShot,
    'title' | 'description' | 'shotType' | 'cameraMove' | 'imagePrompt' | 'negativePrompt'
  >,
  ctx: UnifiedShotPromptContext
): string {
  const cast = ctx.cast
  const animalOnly = isAnimalOnlyCast(cast)
  const inShot = castMembersInShot(
    {
      title: shot.title,
      description: shot.description,
      image_prompt: shot.imagePrompt
    },
    cast
  )

  const directorBible = buildDirectorBibleBlock(ctx.director ?? undefined)
  const mem = (ctx.continuityMemory || '').trim()
  const fullCastBible = buildCastBibleParagraph(cast)
  const characterLock = buildCharacterLockForShot(inShot, animalOnly)
  const { w, h } = parseProjectAspectRatio(ctx.aspectRatio || '16:9')
  const aspectLine = `Frame aspect ratio: ${w}:${h}.`

  const sceneLines: string[] = []
  if (ctx.sceneTitle?.trim()) sceneLines.push(`Slug: ${ctx.sceneTitle.trim()}`)
  if (ctx.sceneSummary?.trim()) sceneLines.push(`Scene: ${ctx.sceneSummary.trim()}`)
  const sceneBlock = sceneLines.length
    ? ['SETTING (locked across this scene):', ...sceneLines].join('\n')
    : ''

  const panelBeat = (shot.imagePrompt || shot.description || shot.title || '').trim()
  const title = (shot.title || 'Shot').trim()
  const shotType = (shot.shotType || 'medium').trim()

  const negative = mergeNegativePromptParts(
    shot.negativePrompt,
    buildProjectNegativePrompt({ cast })
  )
  const negBlock = formatNegativePromptForImageModel(negative)

  const parts = [
    directorBible,
    mem ? `CONTINUITY MEMORY (do not contradict):\n${mem.slice(0, 2500)}` : '',
    sceneBlock,
    fullCastBible ? `FULL CAST BIBLE (same designs every panel):\n${fullCastBible}` : '',
    characterLock,
    animalOnly
      ? 'ANIMAL-ONLY STORY: only the named animal/creature cast — never humans or human silhouettes.'
      : '',
    SINGLE_STORYBOARD_FRAME_DIRECTIVE,
    aspectLine,
    [
      `STILL FRAME FOR THIS PANEL: "${title}" · ${shotType}`,
      shot.cameraMove ? `Camera: ${shot.cameraMove}` : '',
      '',
      panelBeat
    ]
      .filter(Boolean)
      .join('\n'),
    negBlock
  ]

  return trimPromptForImageModel(dedupeJoinBlocks(...parts))
}

/** Frame API: use unified prompt as-is when complete; otherwise build it once. */
export function resolveFrameGenerationPrompt (
  shot: CreativeShot,
  ctx: UnifiedShotPromptContext
): string {
  const manual = mergeLegacyShotPromptsToUnified(shot)
  if (promptLooksUnified(manual)) {
    return trimPromptForImageModel(manual)
  }
  return buildUnifiedProductionPrompt(shot, ctx)
}

/** Video API: production still + motion beat (no duplicate director/cast blocks). */
export function resolveVideoGenerationPrompt (
  shot: CreativeShot,
  ctx: UnifiedShotPromptContext
): string {
  const production = promptLooksUnified(shot.imagePrompt)
    ? shot.imagePrompt.trim()
    : buildUnifiedProductionPrompt(shot, ctx)
  const motion = buildMotionPromptForShot(shot)
  return trimPromptForImageModel(
    dedupeJoinBlocks(
      production,
      '---',
      motion
    )
  )
}

export function applyUnifiedPromptsToShot (
  shot: CreativeShot,
  ctx: UnifiedShotPromptContext
): Pick<CreativeShot, 'imagePrompt' | 'videoPrompt' | 'negativePrompt'> {
  const production = buildUnifiedProductionPrompt(shot, ctx)
  const negative = mergeNegativePromptParts(
    shot.negativePrompt,
    buildProjectNegativePrompt({
      cast: ctx.cast.map(c => ({ name: c.name, traitsRoleVisual: c.traitsRoleVisual }))
    })
  )
  return {
    imagePrompt: production,
    videoPrompt: buildMotionPromptForShot({ ...shot, description: shot.description }),
    negativePrompt: negative
  }
}
