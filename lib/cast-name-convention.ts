/**
 * Cast naming for prompts and matching:
 * - Cast names appear in ALL CAPS in production prompts (e.g. DOG, CAT).
 * - ALL CAPS tokens refer to the project's cast bible + portraits, not generic animals.
 * - Species-like names (dog, cat) only match when written in ALL CAPS (or full small-cast fallback).
 */

export function normalizeCharacterNameKey (name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** How a cast member's name must appear in image/video prompts. */
export function formatCastNameForPrompt (name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase()
}

const SPECIES_LIKE_CAST_NAMES = new Set([
  'dog',
  'cat',
  'bird',
  'bear',
  'fox',
  'rabbit',
  'mouse',
  'rat',
  'horse',
  'cow',
  'pig',
  'fish',
  'frog',
  'owl',
  'lion',
  'tiger',
  'wolf',
  'deer',
  'duck',
  'chicken',
  'goat',
  'sheep',
  'hamster',
  'squirrel',
  'turtle',
  'snake',
  'puppy',
  'kitten'
])

export function isSpeciesLikeCastName (name: string): boolean {
  const key = normalizeCharacterNameKey(name)
  if (!key) return false
  if (SPECIES_LIKE_CAST_NAMES.has(key)) return true
  return key.split(' ').every(t => SPECIES_LIKE_CAST_NAMES.has(t))
}

function escapeRegExp (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * True when text references this cast member.
 * Species-like names (DOG, CAT) require the ALL CAPS cast token — lowercase "dog" is not a match.
 */
export function castNameAppearsInText (name: string, text: string): boolean {
  const key = normalizeCharacterNameKey(name)
  if (!key || !text.trim()) return false

  const caps = formatCastNameForPrompt(name)
  const capsRe = new RegExp(`\\b${escapeRegExp(caps)}\\b`)
  if (capsRe.test(text)) return true

  if (isSpeciesLikeCastName(name)) return false

  const looseRe = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'i')
  if (looseRe.test(text)) return true

  const tokens = key.split(' ').filter(t => t.length >= 3)
  if (tokens.length > 1) {
    const hay = text.toLowerCase()
    if (tokens.every(t => new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i').test(hay))) return true
  }
  return false
}

/** Rewrite shot copy so every cast name uses the ALL CAPS convention. */
export function canonicalizeCastNamesInText (
  text: string,
  cast: Array<{ name: string }>
): string {
  let out = text
  if (!out.trim() || !cast.length) return out

  const sorted = [...cast].sort((a, b) => b.name.length - a.name.length)
  for (const c of sorted) {
    const key = normalizeCharacterNameKey(c.name)
    if (!key) continue
    const caps = formatCastNameForPrompt(c.name)
    const re = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'gi')
    out = out.replace(re, caps)
  }
  return out
}

export function canonicalizeShotCastNames<T extends {
  title?: string
  description?: string
  imagePrompt?: string
  image_prompt?: string
  videoPrompt?: string
  video_prompt?: string
}> (
  shot: T,
  cast: Array<{ name: string }>
): T {
  const canon = (s: string | undefined) => canonicalizeCastNamesInText(s || '', cast)
  return {
    ...shot,
    title: canon(shot.title),
    description: canon(shot.description),
    imagePrompt: shot.imagePrompt != null ? canon(shot.imagePrompt) : shot.imagePrompt,
    image_prompt: shot.image_prompt != null ? canon(shot.image_prompt) : shot.image_prompt,
    videoPrompt: shot.videoPrompt != null ? canon(shot.videoPrompt) : shot.videoPrompt,
    video_prompt: shot.video_prompt != null ? canon(shot.video_prompt) : shot.video_prompt
  }
}

/** Explains ALL CAPS cast tokens for image models. */
export function castNameConventionPromptBlock (cast: Array<{ name: string }>): string {
  if (!cast.length) return ''
  const names = cast.map(c => formatCastNameForPrompt(c.name)).filter(Boolean)
  const speciesNote = cast.some(c => isSpeciesLikeCastName(c.name))
    ? ' Names like DOG or CAT are proper character identities from the cast bible — never render a generic stock animal when these tokens appear.'
    : ''
  return [
    'CAST NAME TOKENS (mandatory):',
    `The tokens ${names.join(', ')} written in ALL CAPITAL LETTERS are this project's cast characters — use their exact visual design from the cast bible and reference portraits.${speciesNote}`,
    'Lowercase species words alone (e.g. "a dog") must NOT replace a cast token; only the ALL CAPS name refers to the approved character design.'
  ].join('\n')
}
