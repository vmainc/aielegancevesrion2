import {
  extractVisualBriefFromNarrative,
  isStoryHeavyDescription,
  nameBasedVisualStub
} from '~/lib/character-visual-description'

const STYLE_FRAGMENTS: Record<string, string> = {
  cinematic:
    'Cinematic lighting on the subject, film-quality color grade, shallow depth of field, dramatic but natural shadows on the character only.',
  realistic:
    'Photorealistic, natural skin or fur texture, accurate materials, studio reference lighting.',
  anime:
    'Anime-inspired illustration, clean line art, expressive features, cohesive palette.',
  fantasy:
    'Fantasy art direction, rich materials and costume detail on the subject only.',
  'sci-fi':
    'Science-fiction aesthetic, sleek or industrial costume/tech details on the subject only.',
  custom: 'Follow the appearance description closely; flexible interpretation of look only.'
}

export const CHARACTER_STYLE_PRESETS = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'realistic', label: 'Realistic' },
  { value: 'anime', label: 'Anime' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'custom', label: 'Custom' }
] as const

/** Preferred Character Creator plate: chroma green (keyable); black if green clashes with the subject. */
export const CHARACTER_CREATOR_BACKGROUND =
  'solid flat chroma-key green background (#00FF00), evenly lit, no gradients, no floor, no horizon. If the character is predominantly green, use solid pure black (#000000) instead.'

/** Appended after optional Production Bible so scene notes cannot override the plate rules. */
export const CHARACTER_CREATOR_PLATE_OVERRIDE =
  'CHARACTER PLATE OVERRIDE: Ignore any scene, location, or action from continuity notes. Keep exactly ONE subject. Appearance and costume only. Isolate on solid chroma-key green (#00FF00), or solid black if the subject is mostly green.'

const ACTION_OR_SCENE_BEAT =
  /\b(leaps?|jumps?|chases?|runs?|plays?|playfully|engages?|seeking|interacts?|talks?|speaks?|dialogue|scene|moment|over the|with the|towards? the|across|beside|behind|onto|into)\b/i

/**
 * Prefer appearance-only text for image generation — strip plot/action blurbs.
 */
export function sanitizeCharacterCreatorDescription (name: string, description: string): string {
  const desc = (description || '').trim()
  if (!desc) return nameBasedVisualStub(name)

  if (isStoryHeavyDescription(desc) || ACTION_OR_SCENE_BEAT.test(desc)) {
    const extracted = extractVisualBriefFromNarrative(desc, name).trim()
    if (extracted) return extracted
  }

  return desc
}

export function finalizeCharacterCreatorPrompt (prompt: string): string {
  const base = prompt.trim()
  if (!base) return CHARACTER_CREATOR_PLATE_OVERRIDE
  if (base.includes('CHARACTER PLATE OVERRIDE:')) return base
  return `${base}\n\n${CHARACTER_CREATOR_PLATE_OVERRIDE}`
}

export function buildCharacterImagePrompt (
  name: string,
  description: string,
  stylePreset: string,
  options?: { hasReferenceImage?: boolean }
): string {
  const style = STYLE_FRAGMENTS[stylePreset] ?? STYLE_FRAGMENTS.custom
  const safeName = (name || '').trim() || 'Character'
  const desc = sanitizeCharacterCreatorDescription(safeName, description)
  const refLine = options?.hasReferenceImage
    ? 'A reference image is attached — preserve its character design (face, proportions, materials, colors) while applying the appearance description and style below.'
    : ''
  return [
    'Create a character reference plate for film casting / continuity.',
    refLine,
    '',
    'HARD RULES (must follow):',
    `- Exactly ONE character: ${safeName}. No other people, animals, or creatures in frame.`,
    '- Appearance and costume only — do not depict story action, interaction, chase, leap, dialogue, or a narrative beat.',
    `- Full subject isolated against a ${CHARACTER_CREATOR_BACKGROUND}`,
    '- Neutral standing or simple three-quarter portrait pose facing camera; no props that imply a scene unless they are worn (collar, clothes, accessories).',
    '- No environment, set, furniture, landscape, or multi-character composition.',
    '',
    `Character Name: ${safeName}`,
    '',
    'Appearance (look & feel only):',
    desc,
    '',
    'Style:',
    style,
    '',
    'High detail, consistent studio lighting on the subject, professional quality character sheet.'
  ]
    .filter(Boolean)
    .join('\n')
}

export function isValidStylePreset (key: string): boolean {
  return Object.prototype.hasOwnProperty.call(STYLE_FRAGMENTS, key)
}
