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
  trimPromptForImageModel
} from '~/lib/storyboard-continuity-prompts'

export { normalizeCharacterNameKey } from '~/lib/cast-name-convention'
import { formatCastLineForProductionPrompt } from '~/lib/character-visual-description'
import { SINGLE_STORYBOARD_FRAME_DIRECTIVE } from '~/lib/storyboard-frame-image'
import { applyVideoNoBackgroundMusicPolicy } from '~/lib/video-generation-audio-policy'
import { resolveFrameGenerationPrompt, resolveVideoGenerationPrompt } from '~/lib/unified-shot-prompt'
import type { ProjectDirector, ProjectTargetLength } from '~/types/creative-project'
import type { CreativeShot } from '~/types/creative-shot'

export interface ProjectCharacterRef {
  id: string
  name: string
  /** Cast visual bible from Characters step. */
  roleDescription: string
  /** Featured portrait URL when set in Assets / Character Creator. */
  portraitUrl: string | null
  /** Visual notes from the featured portrait asset. */
  portraitNotes?: string
  /** Image prompt used to generate the featured portrait. */
  portraitPromptUsed?: string
}

export function projectCharacterRefToCastMember (c: ProjectCharacterRef) {
  return {
    name: c.name,
    traitsRoleVisual: c.roleDescription,
    portraitUrl: c.portraitUrl,
    portraitNotes: c.portraitNotes,
    portraitPromptUsed: c.portraitPromptUsed
  }
}

function shotRawText (
  shot: Pick<CreativeShot, 'title' | 'description' | 'imagePrompt' | 'videoPrompt'>
): string {
  return [shot.title, shot.description, shot.imagePrompt, shot.videoPrompt].filter(Boolean).join(' ')
}

function isCharacterFocusedShot (
  shot: Pick<CreativeShot, 'title' | 'description' | 'imagePrompt' | 'videoPrompt' | 'shotType'>
): boolean {
  const t = `${shot.shotType || ''} ${shot.title || ''} ${shot.imagePrompt || ''} ${shot.description || ''}`.toLowerCase()
  return /close-up|close up|portrait|face|eyes|expression|reaction|greeting|dialogue|character|medium shot|two shot|over-the-shoulder|ots\b/.test(t)
}

/** Characters whose names appear in shot copy (longest names first to avoid partial hits). */
export function findCharactersInShot (
  shot: Pick<CreativeShot, 'title' | 'description' | 'imagePrompt' | 'videoPrompt' | 'shotType'>,
  cast: ProjectCharacterRef[],
  sceneSummary?: string
): ProjectCharacterRef[] {
  const raw = shotRawText(shot)
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

  if (!hits.length && sceneSummary?.trim()) {
    for (const c of sorted) tryAdd(c, sceneSummary)
  }

  // Small casts: always treat every character as in-scope (matches server castMembersInShot).
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

/** Portrait URLs for vision models (in-shot cast first, then remaining cast with portraits). */
export function collectCharacterPortraitUrls (
  characters: ProjectCharacterRef[],
  max = 4
): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const add = (c: ProjectCharacterRef) => {
    const u = (c.portraitUrl || '').trim()
    if (!u || seen.has(u)) return
    seen.add(u)
    urls.push(u)
  }
  for (const c of characters) add(c)
  return urls.slice(0, max)
}

export function buildContinuityPromptBlock (matches: ProjectCharacterRef[]): string {
  if (!matches.length) return ''
  const lines = matches.map((c) => {
    const line = formatCastLineForProductionPrompt({
      name: c.name,
      roleDescription: c.roleDescription,
      portraitUrl: c.portraitUrl,
      portraitNotes: c.portraitNotes,
      portraitPromptUsed: c.portraitPromptUsed
    })
    return `- ${line}`
  })
  return [
    'CHARACTER CONTINUITY (mandatory — match these designs exactly in this frame; same face, body, materials, colors, and style as the cast bible):',
    ...lines,
    'Do not invent a new look for any named character. If multiple characters appear, keep each distinct but faithful to their description.'
  ].join('\n')
}

function formatDirectorForPrompt (d: ProjectDirector | undefined): string {
  if (!d) return ''
  const chunks: string[] = []
  if (d.style?.trim()) chunks.push(`Visual style: ${d.style.trim()}`)
  if (d.tone?.trim()) chunks.push(`Directorial tone: ${d.tone.trim()}`)
  if (d.camera_preferences?.trim()) chunks.push(`Camera preferences: ${d.camera_preferences.trim()}`)
  if (d.lighting_style?.trim()) chunks.push(`Lighting: ${d.lighting_style.trim()}`)
  if (d.pacing?.trim()) chunks.push(`Pacing: ${d.pacing.trim()}`)
  return chunks.join('\n').slice(0, 6000)
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
}

function buildDirectorAndLightingBlock (ctx: ProductionPromptContext): string {
  const dir = formatDirectorForPrompt(ctx.director)
  const mem = (ctx.continuityMemory || '').trim()
  const parts: string[] = []
  if (dir) {
    parts.push(
      'VISUAL STYLE & LIGHTING (project-wide — use the same look in every panel; do not reset style between shots):',
      dir
    )
  }
  if (mem) {
    parts.push('CONTINUITY MEMORY (carry forward across all panels):', mem)
  }
  return parts.join('\n')
}

function buildSceneEnvironmentBlock (scene?: { heading: string; summary?: string }): string {
  const heading = scene?.heading?.trim() || ''
  const summary = scene?.summary?.trim() || ''
  if (!heading && !summary) return ''
  const lines = [
    'SETTING & ENVIRONMENT (same location, props, and time-of-day across panels in this scene unless this shot explicitly changes them):'
  ]
  if (heading) lines.push(`Slug: ${heading}`)
  if (summary) lines.push(`Scene: ${summary}`)
  lines.push(
    'Keep background architecture, diner layout, color palette, and practical lights consistent with this setting.'
  )
  return lines.join('\n')
}

/** Full project cast — same wording every time so models do not redesign characters per panel. */
export function buildCastBibleBlock (cast: ProjectCharacterRef[]): string {
  if (!cast.length) return ''
  const lines = cast.map((c) => {
    const line = formatCastLineForProductionPrompt({
      name: c.name,
      roleDescription: c.roleDescription,
      portraitUrl: c.portraitUrl,
      portraitNotes: c.portraitNotes,
      portraitPromptUsed: c.portraitPromptUsed
    })
    return `- ${line}`
  })
  return [
    'CAST BIBLE (describe every named character exactly as below — same face, body, materials, colors, and proportions in every panel):',
    ...lines
  ].join('\n')
}

function shotMotionText (
  shot: ProductionPromptContext['shot']
): string {
  const v = (shot.videoPrompt || '').trim()
  if (v) return v
  const i = (shot.imagePrompt || '').trim()
  if (i) return i
  return (shot.description || '').trim()
}

function buildSharedProductionBlocks (
  ctx: Pick<ProductionPromptContext, 'director' | 'continuityMemory' | 'scene' | 'cast' | 'shot'>
): string[] {
  const inShot = findCharactersInShot(ctx.shot, ctx.cast, ctx.scene?.summary)
  const castForBible = ctx.cast.length ? ctx.cast : inShot
  const parts: string[] = []

  const directorBlock = buildDirectorAndLightingBlock(ctx)
  if (directorBlock) parts.push(directorBlock)

  const sceneBlock = buildSceneEnvironmentBlock(ctx.scene)
  if (sceneBlock) parts.push(sceneBlock)

  const castBlock = buildCastBibleBlock(castForBible)
  if (castBlock) parts.push(castBlock)
  else if (inShot.length) parts.push(buildContinuityPromptBlock(inShot))

  return parts
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

  let prompt = resolveVideoGenerationPrompt(shotForVideo, {
    director: ctx.director,
    continuityMemory: ctx.continuityMemory,
    aspectRatio: ctx.aspectRatio,
    sceneTitle: ctx.scene?.heading,
    sceneSummary: ctx.scene?.summary,
    cast: ctx.cast.map(c => projectCharacterRefToCastMember(c))
  })
  if (isMusicVideoTarget(ctx.targetLength)) {
    prompt +=
      '\n\nMusic video: visuals only — sync to the external track on the timeline; no dialogue or vocals in the clip.'
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
    cast: (ctx.cast.length ? ctx.cast : matches).map(c => projectCharacterRefToCastMember(c))
  })
}

/** @deprecated Use buildFullVideoGenerationPrompt — kept for any legacy imports */
export function buildVideoMotionPrompt (
  basePrompt: string,
  matches: ProjectCharacterRef[]
): string {
  const base = basePrompt.trim()
  const block = buildContinuityPromptBlock(matches)
  if (!block) return base
  return `${block}\n\nMOTION / ACTION:\n${base}`
}
