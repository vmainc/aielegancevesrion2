import type { CreativeShot } from '~/types/creative-shot'
import type { FilmControls } from '~/types/image-generation'
import {
  FILM_CONTROL_CAMERA_ANGLES,
  FILM_CONTROL_SHOT_SIZES
} from '~/lib/image-generation-defaults'

function normalizeKey (s: string): string {
  return s.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const SHOT_SIZE_ALIASES: Array<{ match: RegExp; value: (typeof FILM_CONTROL_SHOT_SIZES)[number] }> = [
  { match: /\bextreme\s*wide\b|\bews\b|\bestablishing\b/, value: 'Extreme Wide' },
  { match: /\bwide\b|\bls\b|\blong\s*shot\b/, value: 'Wide' },
  { match: /\bmedium\s*wide\b|\bmws\b/, value: 'Medium Wide' },
  { match: /\bmedium\s*close[-\s]?up\b|\bmcu\b/, value: 'Medium Close-Up' },
  { match: /\bextreme\s*close[-\s]?up\b|\becu\b|\binsert\b/, value: 'Extreme Close-Up' },
  { match: /\bclose[-\s]?up\b|\bcu\b/, value: 'Close-Up' },
  { match: /\bmedium\b|\bms\b/, value: 'Medium' }
]

const ANGLE_ALIASES: Array<{ match: RegExp; value: (typeof FILM_CONTROL_CAMERA_ANGLES)[number] }> = [
  { match: /\beye\s*level\b/, value: 'Eye Level' },
  { match: /\blow\s*angle\b/, value: 'Low Angle' },
  { match: /\bhigh\s*angle\b/, value: 'High Angle' },
  { match: /\boverhead\b|\bbird'?s?\s*eye\b|\btop\s*down\b/, value: 'Overhead' },
  { match: /\bdutch\b|\bcanted\b/, value: 'Dutch Angle' },
  { match: /\bpov\b|\bpoint\s*of\s*view\b/, value: 'POV' },
  { match: /\bover[-\s]?the[-\s]?shoulder\b|\bots\b/, value: 'Over-the-Shoulder' }
]

function firstMatch<T extends string> (
  text: string,
  rules: Array<{ match: RegExp; value: T }>
): T | null {
  for (const rule of rules) {
    if (rule.match.test(text)) return rule.value
  }
  return null
}

/**
 * Map storyboard shot fields onto Generate → Images film controls.
 * Uses shotType / cameraMove (and description as a fallback cue). Best-effort only.
 */
export function filmControlsFromShot (
  shot: Pick<CreativeShot, 'shotType' | 'cameraMove' | 'description' | 'title'>
): FilmControls {
  const typeText = normalizeKey(`${shot.shotType || ''} ${shot.title || ''}`)
  const moveText = normalizeKey(`${shot.cameraMove || ''} ${shot.description || ''}`)
  const combined = normalizeKey(
    `${shot.shotType || ''} ${shot.cameraMove || ''} ${shot.description || ''} ${shot.title || ''}`
  )

  return {
    shotSize: firstMatch(typeText, SHOT_SIZE_ALIASES) || firstMatch(combined, SHOT_SIZE_ALIASES),
    cameraAngle: firstMatch(moveText, ANGLE_ALIASES) || firstMatch(combined, ANGLE_ALIASES),
    lens: null,
    lighting: null,
    style: 'Film Still'
  }
}

/** Prompt text preferred for Generate → Images when opening from a shot. */
export function imagePromptFromShot (
  shot: Pick<CreativeShot, 'imagePrompt' | 'description' | 'title' | 'shotType' | 'cameraMove'>
): string {
  const primary = (shot.imagePrompt || shot.description || '').trim()
  if (primary) return primary
  const bits = [
    shot.title?.trim(),
    shot.shotType?.trim(),
    shot.cameraMove?.trim()
  ].filter(Boolean)
  return bits.join(' — ')
}
