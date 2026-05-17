import { isMusicVideoTarget } from '~/lib/project-video-audio'
import type { ProjectDirector, ProjectTargetLength } from '~/types/creative-project'
import type { CreativeShot } from '~/types/creative-shot'

export interface ProjectCharacterRef {
  id: string
  name: string
  /** Cast visual bible from Characters step. */
  roleDescription: string
  /** Featured portrait URL when set in Assets / Character Creator. */
  portraitUrl: string | null
}

export function normalizeCharacterNameKey (name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function shotHaystack (
  shot: Pick<CreativeShot, 'title' | 'description' | 'imagePrompt' | 'videoPrompt'>
): string {
  return [shot.title, shot.description, shot.imagePrompt, shot.videoPrompt].join(' ').toLowerCase()
}

function nameAppearsInHaystack (name: string, haystack: string): boolean {
  const key = normalizeCharacterNameKey(name)
  if (!key) return false
  if (haystack.includes(key)) return true
  const tokens = key.split(' ').filter(t => t.length >= 3)
  if (tokens.length > 1 && tokens.every(t => haystack.includes(t))) return true
  return false
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
  const haystack = shotHaystack(shot)
  const sorted = [...cast].sort((a, b) => b.name.length - a.name.length)
  const hits: ProjectCharacterRef[] = []
  const seen = new Set<string>()

  const tryAdd = (c: ProjectCharacterRef, text: string) => {
    const key = normalizeCharacterNameKey(c.name)
    if (!key || seen.has(key)) return
    if (nameAppearsInHaystack(c.name, text)) {
      seen.add(key)
      hits.push(c)
    }
  }

  if (haystack.trim()) {
    for (const c of sorted) tryAdd(c, haystack)
  }

  if (!hits.length && sceneSummary?.trim() && isCharacterFocusedShot(shot)) {
    const sceneText = sceneSummary.toLowerCase()
    for (const c of sorted) tryAdd(c, sceneText)
  }

  return hits
}

export function pickPrimaryCharacterPortrait (matches: ProjectCharacterRef[]): string | null {
  for (const c of matches) {
    const u = (c.portraitUrl || '').trim()
    if (u) return u
  }
  return null
}

export function buildContinuityPromptBlock (matches: ProjectCharacterRef[]): string {
  if (!matches.length) return ''
  const lines = matches.map((c) => {
    const desc = (c.roleDescription || '').trim() || 'See established character design.'
    return `- ${c.name.toUpperCase()}: ${desc}`
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
    const desc = (c.roleDescription || '').trim() || 'Use the established design from earlier panels.'
    return `- ${c.name.toUpperCase()}: ${desc}`
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
  const motion = shotMotionText(ctx.shot)
  if (!motion) return ''

  const parts = buildSharedProductionBlocks(ctx)

  const title = (ctx.shot.title || 'Shot').trim()
  const shotType = (ctx.shot.shotType || 'shot').trim()
  const camera = (ctx.shot.cameraMove || '').trim()
  const musicVideoRules = isMusicVideoTarget(ctx.targetLength)
    ? 'This is a music video: visuals only — no dialogue, voiceover, or synced soundtrack in the generated clip (music is added in edit). Favor performance, mood, and rhythm.'
    : ''

  const panelLines = [
    `THIS PANEL ONLY: "${title}" · ${shotType}`,
    camera ? `Camera move: ${camera}` : '',
    '',
    'MOTION & ACTION (execute only this beat — not the previous or next panel in the sequence):',
    motion,
    '',
    'Rules: Do not repeat the previous panel’s framing or action. If this is a close-up, do not output another wide establishing shot. If this is a medium shot on a character, keep that character’s design identical to the cast bible above. Match the location and lighting from SETTING and VISUAL STYLE.',
    musicVideoRules
  ].filter(Boolean)

  parts.push(panelLines.join('\n'))
  return parts.join('\n\n').trim()
}

export function buildStoryboardFramePrompt (
  basePrompt: string,
  matches: ProjectCharacterRef[],
  ctx?: ProductionPromptContext
): string {
  const base = basePrompt.trim()
  if (!ctx) {
    const block = buildContinuityPromptBlock(matches)
    if (!block) return base
    return `${block}\n\nSTILL FRAME FOR THIS PANEL:\n${base}`
  }

  const shot = ctx.shot
  const parts = buildSharedProductionBlocks({
    ...ctx,
    shot: {
      ...shot,
      imagePrompt: base || shot.imagePrompt,
      videoPrompt: shot.videoPrompt || ''
    }
  })

  const title = (shot.title || 'Shot').trim()
  const shotType = (shot.shotType || 'shot').trim()
  parts.push(
    [
      `STILL FRAME FOR THIS PANEL: "${title}" · ${shotType}`,
      '',
      'Compose a single storyboard image (not motion). Match cast, setting, and lighting above exactly.',
      base
    ].join('\n')
  )
  return parts.join('\n\n').trim()
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
