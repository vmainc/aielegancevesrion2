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

export function buildStoryboardFramePrompt (
  basePrompt: string,
  matches: ProjectCharacterRef[]
): string {
  const base = basePrompt.trim()
  const block = buildContinuityPromptBlock(matches)
  if (!block) return base
  return `${block}\n\nPANEL:\n${base}`
}

export function buildVideoMotionPrompt (
  basePrompt: string,
  matches: ProjectCharacterRef[]
): string {
  const base = basePrompt.trim()
  const block = buildContinuityPromptBlock(matches)
  if (!block) return base
  return `${block}\n\nMOTION / ACTION:\n${base}`
}
