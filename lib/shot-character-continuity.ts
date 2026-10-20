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

/**
 * The storyboard still lists who is actually in the panel:
 * `Cast in this panel: NAME, NAME.` or `none`.
 * Returns null when that line is absent.
 */
export function declaredCastNamesInPanel (imagePrompt: string): string[] | null {
  const m = (imagePrompt || '').match(/Cast in this panel:\s*([^\n]+)/i)
  if (!m) return null
  const line = m[1].trim().replace(/\.\s*$/, '')
  if (/^none\b/i.test(line)) return []
  return line
    .split(/,|(?:\s+and\s+)/i)
    .map((s) => s.replace(/[.)]+$/g, '').trim())
    .filter((n) => n && !/^none$/i.test(n))
}

function castNameMatchesDeclared (castName: string, declared: string): boolean {
  const a = normalizeCharacterNameKey(castName)
  const b = normalizeCharacterNameKey(declared)
  if (!a || !b) return false
  if (a === b) return true
  return castNameAppearsInText(castName, declared) || castNameAppearsInText(declared, castName)
}

/**
 * Characters named in this panel's beat — not the scene summary and not the project cast.
 * When the still says "Cast in this panel:", that list wins over a loose name search.
 */
export function findCharactersInShot (
  shot: Pick<CreativeShot, 'title' | 'description' | 'imagePrompt' | 'videoPrompt' | 'shotType'>,
  cast: ProjectCharacterRef[]
): ProjectCharacterRef[] {
  const declared = declaredCastNamesInPanel(shot.imagePrompt || '')
  if (declared) {
    if (!declared.length) return []
    const hits: ProjectCharacterRef[] = []
    const seen = new Set<string>()
    const sorted = [...cast].sort((a, b) => b.name.length - a.name.length)
    for (const name of declared) {
      const match = sorted.find((c) => castNameMatchesDeclared(c.name, name))
      if (!match) continue
      const key = normalizeCharacterNameKey(match.name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      hits.push(match)
    }
    return hits
  }

  const raw = shotTextForCastMatch(shot)
  if (!raw.trim()) return []
  const sorted = [...cast].sort((a, b) => b.name.length - a.name.length)
  const hits: ProjectCharacterRef[] = []
  const seen = new Set<string>()

  for (const c of sorted) {
    const key = normalizeCharacterNameKey(c.name)
    if (!key || seen.has(key)) continue
    if (castNameAppearsInText(c.name, raw)) {
      seen.add(key)
      hits.push(c)
    }
  }

  return hits
}

/** Same cast resolution as frame prompts — use for portrait attachment, not only name grep. */
export function resolveCharactersForFrameGeneration (
  shot: Pick<CreativeShot, 'title' | 'description' | 'imagePrompt' | 'videoPrompt' | 'shotType'>,
  cast: ProjectCharacterRef[]
): ProjectCharacterRef[] {
  return findCharactersInShot(shot, cast)
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
 * Cast plate URLs for vision models (headshot/featured first per character, then turnarounds).
 * Round-robins so multi-character shots still get one face plate each before extras.
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
  // Pass 1: one headshot / primary identity plate per character (face lock).
  for (const plates of perChar) {
    if (urls.length >= max) break
    if (plates[0]) add(plates[0])
  }
  // Pass 2+: round-robin remaining plates (front / profiles) into leftover slots.
  let round = 1
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
    const hasHeadshot = Boolean((c.portraitUrl || '').trim() || (c.plateUrls || [])[0])
    return hasHeadshot
      ? `- ${line} — MATCH LOOKBOOK HEADSHOT exactly (facial hair, hairline, age, face shape).`
      : `- ${line}`
  })
  return [
    'CHARACTER CONTINUITY (mandatory — match these designs exactly in this frame; same face, body, materials, colors, and style as the cast bible):',
    ...lines,
    'FACE LOCK FROM HEADSHOT: when a lookbook headshot is attached, copy that face identity exactly — including clean-shaven vs beard/mustache. Do not invent facial hair or shave a beard that is in the headshot.',
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
 * Motion prompt for a storyboard panel. Start/end frames carry the still;
 * this text is only the beat the clip should animate.
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
  const continuity = buildContinuityPromptBlock(ctx.cast)
  if (continuity && !/CHARACTER CONTINUITY/i.test(prompt)) {
    prompt = `${prompt}\n\n${continuity}`
  }
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
