import {
  castNameAppearsInText,
  formatCastNameForPrompt,
  normalizeCharacterNameKey
} from '~/lib/cast-name-convention'
import { isMusicVideoTarget } from '~/lib/project-video-audio'
import {
  buildProjectNegativePrompt,
  formatNegativePromptForImageModel,
  isAnimalOnlyCast,
  mergeNegativePromptParts,
  shotTextForCastMatch,
  trimPromptForImageModel
} from '~/lib/storyboard-continuity-prompts'

export { normalizeCharacterNameKey } from '~/lib/cast-name-convention'
import { formatCastLineForProductionPrompt, castMemberToVisualInput } from '~/lib/character-visual-description'
import { SINGLE_STORYBOARD_FRAME_DIRECTIVE } from '~/lib/storyboard-frame-image'
import { applyVideoNoBackgroundMusicPolicy } from '~/lib/video-generation-audio-policy'
import { resolveFrameGenerationPrompt, resolveShotVideoGenerationPrompt } from '~/lib/unified-shot-prompt'
import type { ProjectDirector, ProjectTargetLength } from '~/types/creative-project'
import type { ProductionBibleResolvedContext } from '~/types/production-bible-context'
import type { CreativeShot } from '~/types/creative-shot'

export interface ProjectCharacterRef {
  id: string
  name: string
  /** Cast visual bible from Characters step. */
  roleDescription: string
  /** Featured portrait URL when set in Assets / Character Creator. */
  portraitUrl: string | null
  /**
   * Isolation / turnaround plates for this character (featured first, then Front / 3⁄4 / Profile).
   * Attached as vision references when generating storyboard or video seed frames.
   */
  plateUrls?: string[]
  /** Visual notes from the featured portrait asset. */
  portraitNotes?: string
  /** Image prompt used to generate the featured portrait. */
  portraitPromptUsed?: string
  /** Cast voice bible notes (reference clips on Characters step). */
  voiceDescription?: string
  /** Locked visual anchor from character profile. */
  appearanceDescription?: string
  /** Recurring props, accessories, or tics. */
  signatureDetails?: string
  /** Per-character avoid list for STRICT EXCLUSIONS. */
  avoidDescription?: string
}

export function projectCharacterRefToCastMember (c: ProjectCharacterRef) {
  return {
    name: c.name,
    traitsRoleVisual: c.roleDescription,
    appearanceDescription: c.appearanceDescription,
    signatureDetails: c.signatureDetails,
    avoidDescription: c.avoidDescription,
    portraitUrl: c.portraitUrl,
    portraitNotes: c.portraitNotes,
    portraitPromptUsed: c.portraitPromptUsed
  }
}

function isCharacterFocusedShot (
  shot: Pick<CreativeShot, 'title' | 'description' | 'imagePrompt' | 'videoPrompt' | 'shotType'>
): boolean {
  const t = `${shot.shotType || ''} ${shot.title || ''} ${shot.description || ''}`.toLowerCase()
  return /close-up|close up|portrait|face|eyes|expression|reaction|greeting|dialogue|character|medium shot|two shot|over-the-shoulder|ots\b/.test(t)
}

/** Characters named in this panel's beat — not everyone listed in the cast bible blocks. */
export function findCharactersInShot (
  shot: Pick<CreativeShot, 'title' | 'description' | 'imagePrompt' | 'videoPrompt' | 'shotType'>,
  cast: ProjectCharacterRef[],
  sceneSummary?: string
): ProjectCharacterRef[] {
  const raw = shotTextForCastMatch(shot)
  const sorted = [...cast].sort((a, b) => b.name.length - a.name.length)
  const hits: ProjectCharacterRef[] = []
  const seen = new Set<string>()

  const tryAdd = (c: ProjectCharacterRef, text: string) => {
    const key = normalizeCharacterNameKey(c.name)
    if (!key || seen.has(key)) return
    if (castNameAppearsInText(c.name, text)) {
      seen.add(key)
      hits.push(c)
    }
  }

  if (raw.trim()) {
    for (const c of sorted) tryAdd(c, raw)
  }

  // Scene summary lists scene-level cast — only use for tiny casts when the beat is silent.
  if (!hits.length && sceneSummary?.trim() && cast.length <= 6) {
    for (const c of sorted) tryAdd(c, sceneSummary)
  }

  if (!hits.length && cast.length > 0 && cast.length <= 6) {
    return cast
  }

  return hits
}

/** Same cast resolution as frame prompts — use for portrait attachment, not only name grep. */
export function resolveCharactersForFrameGeneration (
  shot: Pick<CreativeShot, 'title' | 'description' | 'imagePrompt' | 'videoPrompt' | 'shotType'>,
  cast: ProjectCharacterRef[],
  sceneSummary?: string
): ProjectCharacterRef[] {
  return findCharactersInShot(shot, cast, sceneSummary)
}

export function pickPrimaryCharacterPortrait (matches: ProjectCharacterRef[]): string | null {
  return collectCharacterPortraitUrls(matches, 1)[0] ?? null
}

function platesForCharacter (c: ProjectCharacterRef): string[] {
  const plates = (c.plateUrls || [])
    .map(u => (u || '').trim())
    .filter(Boolean)
  const featured = (c.portraitUrl || '').trim()
  if (!featured) return [...new Set(plates)]
  return [featured, ...plates.filter(u => u !== featured)]
}

/**
 * Cast plate URLs for vision models (featured first per character, then turnarounds).
 * Round-robins so multi-character shots still get one plate each before extras.
 */
export function collectCharacterPortraitUrls (
  characters: ProjectCharacterRef[],
  max = 4
): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const add = (u: string) => {
    const t = (u || '').trim()
    if (!t || seen.has(t)) return false
    seen.add(t)
    urls.push(t)
    return true
  }

  const perChar = characters.map(platesForCharacter)
  let round = 0
  while (urls.length < max) {
    let added = false
    for (const plates of perChar) {
      if (urls.length >= max) break
      const next = plates[round]
      if (next && add(next)) added = true
    }
    if (!added) break
    round++
  }
  return urls
}

export function buildContinuityPromptBlock (matches: ProjectCharacterRef[]): string {
  if (!matches.length) return ''
  const lines = matches.map((c) => {
    const line = formatCastLineForProductionPrompt(castMemberToVisualInput(c))
    return `- ${line}`
  })
  return [
    'CHARACTER CONTINUITY (mandatory — match these designs exactly in this frame; same face, body, materials, colors, and style as the cast bible):',
    ...lines,
    'Do not invent a new look for any named character. If multiple characters appear, keep each distinct but faithful to their description.'
  ].join('\n')
}

export interface ProductionPromptContext {
  director?: ProjectDirector
  continuityMemory?: string
  targetLength?: ProjectTargetLength
  aspectRatio?: string
  scene?: { heading: string; summary?: string }
  shot: Pick<
    CreativeShot,
    'title' | 'description' | 'imagePrompt' | 'videoPrompt' | 'shotType' | 'cameraMove'
  >
  cast: ProjectCharacterRef[]
  /** Read-only bible context appended at prompt assembly time (not persisted). */
  productionBible?: ProductionBibleResolvedContext | null
}

/**
 * Full production prompt: director + scene + full cast + this panel’s distinct action.
 * Use for video generation and for the “Final prompt” preview on the Video step.
 */
export function buildFullVideoGenerationPrompt (ctx: ProductionPromptContext): string {
  const shotForVideo = {
    title: ctx.shot.title,
    description: ctx.shot.description,
    shotType: ctx.shot.shotType,
    cameraMove: ctx.shot.cameraMove,
    imagePrompt: ctx.shot.imagePrompt,
    videoPrompt: ctx.shot.videoPrompt,
    negativePrompt:
      'negativePrompt' in ctx.shot
        ? String((ctx.shot as CreativeShot).negativePrompt || '')
        : ''
  } as CreativeShot

  let prompt = resolveShotVideoGenerationPrompt(shotForVideo, {
    director: ctx.director,
    continuityMemory: ctx.continuityMemory,
    aspectRatio: ctx.aspectRatio,
    sceneTitle: ctx.scene?.heading,
    sceneSummary: ctx.scene?.summary,
    cast: ctx.cast.map(c => projectCharacterRefToCastMember(c)),
    productionBible: ctx.productionBible
  })
  if (isMusicVideoTarget(ctx.targetLength)) {
    prompt +=
      '\n\nMusic video: visuals only — sync to the external track during post-production; no dialogue or vocals in the clip.'
  }
  return applyVideoNoBackgroundMusicPolicy(prompt)
}

export function buildStoryboardFramePrompt (
  basePrompt: string,
  matches: ProjectCharacterRef[],
  ctx?: ProductionPromptContext
): string {
  if (!ctx?.shot) {
    const block = buildContinuityPromptBlock(matches)
    const animalNote = isAnimalOnlyCast(matches.map(c => projectCharacterRefToCastMember(c)))
      ? 'ANIMAL-ONLY: render only the named animal characters — no humans.'
      : ''
    const parts = [
      SINGLE_STORYBOARD_FRAME_DIRECTIVE,
      block,
      animalNote,
      `STILL FRAME FOR THIS PANEL:\n${basePrompt.trim()}`
    ].filter(Boolean)
    return trimPromptForImageModel(parts.join('\n\n'))
  }

  const shot = {
    ...ctx.shot,
    imagePrompt: basePrompt.trim() || ctx.shot.imagePrompt,
    negativePrompt:
      'negativePrompt' in ctx.shot
        ? String((ctx.shot as CreativeShot).negativePrompt || '')
        : ''
  } as CreativeShot

  return resolveFrameGenerationPrompt(shot, {
    director: ctx.director,
    continuityMemory: ctx.continuityMemory,
    aspectRatio: ctx.aspectRatio,
    sceneTitle: ctx.scene?.heading,
    sceneSummary: ctx.scene?.summary,
    cast: (ctx.cast.length ? ctx.cast : matches).map(c => projectCharacterRefToCastMember(c)),
    productionBible: ctx.productionBible
  })
}
