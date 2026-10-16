/**
 * Canonical prompt assembly for storyboard frames and shot-based video.
 *
 * Pipeline:
 * 1. Raw shot drafts (AI or manual) → continuity check (server)
 * 2. enrichGeneratedShotsForContinuity → applyUnifiedPromptsToShot (once, before persist)
 * 3. Frame generation: resolveFrameGenerationPrompt
 * 4. Video from stored shot: resolveShotVideoGenerationPrompt (via buildFullVideoGenerationPrompt)
 *
 * User dialogue/ambient for the video tool form lives in lib/video-generation-audio-policy.ts
 * (resolveVideoGenerationUserPrompt) — not here.
 */
import {
  canonicalizeShotCastNames,
  castNameConventionPromptBlock,
  formatCastNameForPrompt
} from '~/lib/cast-name-convention'
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
import type { ProductionBibleResolvedContext } from '~/types/production-bible-context'
import { formatProductionBiblePromptBlock } from '~/lib/format-production-bible-prompt-block'
import { buildSetLockPromptBlock, SET_LOCK_NEGATIVES, type SetLock } from '~/lib/set-lock'
import {
  ensurePropLocksInPrompt,
  hasLockedProps,
  PROP_LOCK_NEGATIVES,
  propsNamedInText,
  type LockedProp
} from '~/lib/prop-lock'
import {
  buildCostumeLockPromptBlock,
  COSTUME_LOCK_NEGATIVES,
  ensureCostumeLockInPrompt,
  resolveCostumeForScene,
  type CharacterCostume
} from '~/lib/costume-lock'
import { applyVoiceLock } from '~/lib/video-generation-audio-policy'

export interface UnifiedShotPromptContext {
  director?: ProjectDirector | null
  continuityMemory?: string
  aspectRatio?: string
  sceneId?: string
  sceneTitle?: string
  sceneSummary?: string
  /** 0-based panel index in the current scene sequence (for distinct compositions). */
  panelIndex?: number
  cast: Array<{
    name: string
    traitsRoleVisual: string
    appearanceDescription?: string
    signatureDetails?: string
    avoidDescription?: string
    voiceDescription?: string
    portraitUrl?: string | null
    portraitNotes?: string
    portraitPromptUsed?: string
    costumes?: CharacterCostume[]
  }>
  /** Read-only Production Bible slice (PASS 9). Appended when present; never persisted. */
  productionBible?: ProductionBibleResolvedContext | null
  /** Locked location / set for this scene (architecture identity, not camera). */
  setLock?: SetLock | null
}

const UNIFIED_MARKERS =
  /DIRECTOR BIBLE|FULL CAST BIBLE|STILL FRAME FOR THIS PANEL|STRICT EXCLUSIONS/i

export function promptLooksUnified (text: string): boolean {
  const t = text.trim()
  return t.length >= 280 && UNIFIED_MARKERS.test(t)
}

export function namedPropsForShot (
  shot: { title?: string; description?: string },
  setLock?: SetLock | null
): LockedProp[] {
  const dressing = setLock?.dressing || []
  const action = [shot.title, shot.description].filter(Boolean).join('\n')
  return propsNamedInText(
    action,
    setLock?.props || [],
    dressing.map((p) => p.entityId)
  )
}

function withPropLocks (
  prompt: string,
  shot: { title?: string; description?: string },
  setLock?: SetLock | null
): string {
  return ensurePropLocksInPrompt(prompt, {
    dressing: setLock?.dressing,
    named: namedPropsForShot(shot, setLock)
  })
}

function castWearsLockedCostume (ctx: UnifiedShotPromptContext): boolean {
  return ctx.cast.some((member) =>
    Boolean(resolveCostumeForScene(member.costumes, ctx.sceneId)?.description.trim())
  )
}

function costumeLockBlockForShot (
  shot: { title?: string; description?: string; imagePrompt?: string; videoPrompt?: string },
  ctx: UnifiedShotPromptContext
): string {
  const beat = {
    title: shot.title,
    description: shot.description,
    image_prompt: shot.imagePrompt,
    video_prompt: shot.videoPrompt
  }
  let inShot = castMembersInShot(beat, ctx.cast)
  // Same small-cast rule as frame plates: if the beat never names anyone, still lock the outfits.
  if (!inShot.length && ctx.cast.length > 0 && ctx.cast.length <= 6) {
    inShot = ctx.cast
  }
  const entries = inShot.flatMap((member) => {
    const costume = resolveCostumeForScene(member.costumes, ctx.sceneId)
    if (!costume?.description.trim()) return []
    return [{
      characterName: member.name,
      lookName: costume.name,
      description: costume.description
    }]
  })
  return buildCostumeLockPromptBlock(entries)
}

function applyCostumeLock (
  prompt: string,
  shot: { title?: string; description?: string; imagePrompt?: string; videoPrompt?: string },
  ctx: UnifiedShotPromptContext
): string {
  return ensureCostumeLockInPrompt(prompt, costumeLockBlockForShot(shot, ctx))
}

function lockPrompt (
  prompt: string,
  shot: { title?: string; description?: string; imagePrompt?: string; videoPrompt?: string },
  ctx: UnifiedShotPromptContext
): string {
  return applyCostumeLock(withPropLocks(prompt, shot, ctx.setLock), shot, ctx)
}

function continuityNegativeExtra (
  shot: { title?: string; description?: string; imagePrompt?: string; videoPrompt?: string },
  ctx: UnifiedShotPromptContext
): string {
  const named = namedPropsForShot(shot, ctx.setLock)
  const parts: string[] = []
  if (hasLockedProps(ctx.setLock?.dressing, named)) parts.push(PROP_LOCK_NEGATIVES)
  if (costumeLockBlockForShot(shot, ctx)) parts.push(COSTUME_LOCK_NEGATIVES)
  return parts.join(', ')
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

/** Lead image models with the unique beat for this panel; consistency blocks follow. */
export function buildPanelActionEmphasis (
  shot: Pick<CreativeShot, 'title' | 'description' | 'shotType' | 'cameraMove'>,
  panelIndex?: number,
  options?: { wardrobeFromCostume?: boolean }
): string {
  const wardrobeFromCostume = Boolean(options?.wardrobeFromCostume)
  const title = (shot.title || 'Shot').trim()
  const beat = (shot.description || '').trim()
  const shotType = (shot.shotType || 'medium').trim()
  const camera = (shot.cameraMove || '').trim()
  const seq =
    panelIndex != null && panelIndex >= 0
      ? `Panel ${panelIndex + 1} in scene sequence.`
      : ''
  return [
    '=== PRIMARY ACTION — THIS PANEL ONLY (must dominate the image) ===',
    seq,
    `"${title}" · ${shotType}${camera ? ` · camera: ${camera}` : ''}`,
    beat || title,
    wardrobeFromCostume
      ? 'Visually distinct COMPOSITION from every other panel: unique action, pose, eyeline, and framing only — never change character face, species, body proportions, or fur/materials. Clothes come only from COSTUME LOCK. Same set architecture every panel; never clone the same camera layout. Photoreal practical location, not a virtual set.'
      : 'Visually distinct COMPOSITION from every other panel: unique action, pose, eyeline, and framing only — never change character face, species, body proportions, fur/materials, or wardrobe. Same set architecture every panel; never clone the same camera layout. Photoreal practical location, not a virtual set.',
    'If this beat includes spoken dialogue, treat it as performance only (mouth, expression, gesture) — never draw captions, speech bubbles, or readable words in the frame.'
  ]
    .filter(Boolean)
    .join('\n')
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
  const shotCanon = canonicalizeShotCastNames(shot, cast)
  const animalOnly = isAnimalOnlyCast(cast)
  const inShot = castMembersInShot(
    {
      title: shotCanon.title,
      description: shotCanon.description,
      image_prompt: shotCanon.imagePrompt
    },
    cast
  )

  const wardrobeFromCostume = castWearsLockedCostume(ctx)
  const directorBible = buildDirectorBibleBlock(ctx.director ?? undefined)
  const mem = (ctx.continuityMemory || '').trim()
  const bibleBlock = formatProductionBiblePromptBlock(ctx.productionBible)
  const fullCastBible = buildCastBibleParagraph(cast, ctx.sceneId)
  const characterLock = buildCharacterLockForShot(inShot, animalOnly, ctx.sceneId)
  const { w, h } = parseProjectAspectRatio(ctx.aspectRatio || '16:9')
  const aspectLine = `Frame aspect ratio: ${w}:${h}.`

  const setLockBlock = buildSetLockPromptBlock(ctx.setLock, ctx.sceneTitle)
  const sceneLines: string[] = []
  if (ctx.sceneTitle?.trim() && !setLockBlock) sceneLines.push(`Slug: ${ctx.sceneTitle.trim()}`)
  if (ctx.sceneSummary?.trim()) sceneLines.push(`Scene: ${ctx.sceneSummary.trim()}`)
  const sceneBlock = setLockBlock
    || (sceneLines.length ? ['SETTING (locked across this scene):', ...sceneLines].join('\n') : '')

  const panelEmphasis = buildPanelActionEmphasis(shotCanon, ctx.panelIndex, { wardrobeFromCostume })
  const castInPanelLine = inShot.length
    ? `Cast in this panel: ${inShot.map(c => formatCastNameForPrompt(c.name)).join(', ')}.`
    : 'Cast in this panel: none (establishing / environment only).'
  const castNaming = castNameConventionPromptBlock(cast)

  const negative = mergeNegativePromptParts(
    shotCanon.negativePrompt,
    buildProjectNegativePrompt({
      cast,
      inShot,
      extra: [SET_LOCK_NEGATIVES, continuityNegativeExtra(shotCanon, ctx)].filter(Boolean).join(', ')
    })
  )
  const negBlock = formatNegativePromptForImageModel(negative)

  const parts = [
    `${panelEmphasis}\n${castInPanelLine}`,
    SINGLE_STORYBOARD_FRAME_DIRECTIVE,
    aspectLine,
    castNaming,
    directorBible,
    mem ? `CONTINUITY MEMORY (do not contradict):\n${mem.slice(0, 2500)}` : '',
    bibleBlock,
    sceneBlock,
    fullCastBible
      ? `FULL CAST BIBLE (same designs every panel — do not change faces${wardrobeFromCostume ? '; clothes follow COSTUME LOCK' : '/wardrobe'}):\n${fullCastBible}`
      : '',
    characterLock,
    animalOnly
      ? 'ANIMAL-ONLY STORY: only the named animal/creature cast — never humans or human silhouettes.'
      : '',
    negBlock
  ]

  return trimPromptForImageModel(lockPrompt(dedupeJoinBlocks(...parts), shotCanon, ctx))
}

/** Frame API: use unified prompt as-is when complete; otherwise build it once. */
export function resolveFrameGenerationPrompt (
  shot: CreativeShot,
  ctx: UnifiedShotPromptContext
): string {
  const shotCanon = canonicalizeShotCastNames(shot, ctx.cast)
  const manual = mergeLegacyShotPromptsToUnified(shotCanon)
  const panelLead = buildPanelActionEmphasis(shotCanon, ctx.panelIndex, {
    wardrobeFromCostume: castWearsLockedCostume(ctx)
  })
  if (promptLooksUnified(manual)) {
    const base = /PRIMARY ACTION — THIS PANEL ONLY/i.test(manual)
      ? manual
      : `${panelLead}\n\n${manual}`
    return trimPromptForImageModel(lockPrompt(base, shotCanon, ctx))
  }
  return buildUnifiedProductionPrompt(shotCanon, ctx)
}

/** Video from a stored shot: production still + motion beat (no duplicate director/cast blocks). */
export function resolveShotVideoGenerationPrompt (
  shot: CreativeShot,
  ctx: UnifiedShotPromptContext
): string {
  const production = promptLooksUnified(shot.imagePrompt)
    ? lockPrompt(shot.imagePrompt.trim(), shot, ctx)
    : buildUnifiedProductionPrompt(shot, ctx)
  const motion = buildMotionPromptForShot(shot)
  const inShot = castMembersInShot(
    {
      title: shot.title,
      description: shot.description,
      image_prompt: shot.imagePrompt,
      video_prompt: shot.videoPrompt
    },
    ctx.cast
  )
  return applyVoiceLock(
    trimPromptForImageModel(
      dedupeJoinBlocks(
        production,
        '---',
        motion
      )
    ),
    inShot
  )
}

/** @deprecated Use resolveShotVideoGenerationPrompt — shot-based video assembly. */
export const resolveVideoGenerationPrompt = resolveShotVideoGenerationPrompt

function mergedShotNegativePrompt (
  shotCanon: CreativeShot,
  ctx: UnifiedShotPromptContext
): string {
  return mergeNegativePromptParts(
    shotCanon.negativePrompt,
    buildProjectNegativePrompt({
      cast: ctx.cast,
      inShot: castMembersInShot(
        {
          title: shotCanon.title,
          description: shotCanon.description,
          image_prompt: shotCanon.imagePrompt
        },
        ctx.cast
      ),
      extra: [SET_LOCK_NEGATIVES, continuityNegativeExtra(shotCanon, ctx)].filter(Boolean).join(', ')
    })
  )
}

/**
 * Normalize shot prompt fields for persist. Idempotent when imagePrompt is already unified.
 */
export function applyUnifiedPromptsToShot (
  shot: CreativeShot,
  ctx: UnifiedShotPromptContext
): Pick<CreativeShot, 'imagePrompt' | 'videoPrompt' | 'negativePrompt'> {
  const cast = ctx.cast
  const shotCanon = canonicalizeShotCastNames(shot, cast)
  const negative = mergedShotNegativePrompt(shotCanon, ctx)

  if (promptLooksUnified(shotCanon.imagePrompt)) {
    return {
      imagePrompt: trimPromptForImageModel(lockPrompt(shotCanon.imagePrompt.trim(), shotCanon, ctx)),
      videoPrompt: buildMotionPromptForShot(shotCanon),
      negativePrompt: negative
    }
  }

  return {
    imagePrompt: buildUnifiedProductionPrompt(shotCanon, ctx),
    videoPrompt: buildMotionPromptForShot({
      ...shotCanon,
      description: shotCanon.description
    }),
    negativePrompt: negative
  }
}
