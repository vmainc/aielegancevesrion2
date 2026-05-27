import { formatCastNameForPrompt } from '~/lib/cast-name-convention'

export interface CharacterVisualPromptInput {
  name: string
  roleDescription?: string
  portraitUrl?: string | null
  /** Asset notes (Character Creator saves the visual prompt here). */
  portraitNotes?: string
  /** Asset metadata.prompt_used from portrait generation. */
  portraitPromptUsed?: string
}

const STORY_HEAVY =
  /\b(protagonist|antagonist|misadventure|story arc|throughout the (film|story|comedy|spot)|sole protagonist|this comedy|the narrative|character who|experiences a|journey through|falling in while|struggles to get out|regaining (her|his|their) composure|leading to (her|his|their))\b/i

const VISUAL_SIGNAL =
  /\b(fur|coat|markings|pattern|whiskers|paws|snout|ears|tail|tabby|calico|breed|species|wardrobe|outfit|wearing|dressed|palette|anime|illustration|photoreal|3d render|cel[\s-]?shaded|build|stocky|slender|fluffy|short hair|eye color|orange|gray|grey|white|black|brown)\b/i

/** True when text reads like plot/role summary, not an image-generation character sheet. */
export function isStoryHeavyDescription (text: string): boolean {
  const t = text.trim()
  if (t.length < 24) return false
  const hasVisual = VISUAL_SIGNAL.test(t)
  const hasStory = STORY_HEAVY.test(t)
  if (hasVisual && !hasStory) return false
  if (hasStory && !hasVisual) return true
  if (hasStory && hasVisual) {
    const ploty =
      /\b(who is the|they experience|before regaining|after (the|a)|leading to)\b/i.test(t)
    return ploty
  }
  return false
}

/** Best visual text for production prompts (prefers portrait notes / image prompts over story blurbs). */
export function resolveCharacterVisualDescription (input: CharacterVisualPromptInput): string {
  const role = (input.roleDescription || '').trim()
  const notes = (input.portraitNotes || '').trim()
  const promptUsed = (input.portraitPromptUsed || '').trim()
  const hasPortrait = Boolean((input.portraitUrl || '').trim())

  for (const candidate of [promptUsed, notes]) {
    if (candidate && !isStoryHeavyDescription(candidate)) return candidate
  }

  if (role && !isStoryHeavyDescription(role)) return role

  if (promptUsed) return promptUsed
  if (notes) return notes

  if (hasPortrait) {
    const storyHint = role && isStoryHeavyDescription(role)
      ? ` Story context (do not redraw as a generic animal): ${role.slice(0, 400)}`
      : ''
    return [
      `VISUAL LOCK: Match the attached reference portrait for ${formatCastNameForPrompt(input.name)} exactly.`,
      'Reproduce species, face shape, fur/feather/skin materials, markings, colors, proportions, and wardrobe from the reference image — not a stock or generic animal.',
      storyHint
    ]
      .filter(Boolean)
      .join(' ')
  }

  return role || 'Use the established design from the cast bible and any saved portraits.'
}

const LIKELY_NARRATIVE_BEAT =
  /\b(accidentally\s+falls|with a splash|paddles|underwater|then emerges|remarks about|the mishap|approaches the (water|pond|edge)|explores a tranquil|climbs out|wide-eyed curiosity)\b/i

const CREATOR_FALLBACK_NO_PORTRAIT =
  'Physical appearance only — species or type, age feel, build, face, hair/fur/skin, colors, markings, and clothing. Skip story beats, scenes, and dialogue.'

const CREATOR_FALLBACK_WITH_PORTRAIT =
  'Featured portrait is saved for this character — match that look (species, markings, colors, face, body, wardrobe). Keep this box to physical design only, not plot.'

/**
 * Short text for Character Creator query `description` — look-focused, not screenplay/story summaries.
 * Prefer portrait notes / image prompt; never dump long production-only “VISUAL LOCK” copy into the URL.
 */
export function visualBriefForCharacterCreator (input: CharacterVisualPromptInput): string {
  const role = (input.roleDescription || '').trim()
  const notes = (input.portraitNotes || '').trim()
  const promptUsed = (input.portraitPromptUsed || '').trim()
  const hasPortrait = Boolean((input.portraitUrl || '').trim())
  const max = 1600

  const clip = (s: string) => (s.length <= max ? s : `${s.slice(0, max).trimEnd()}…`)

  for (const candidate of [promptUsed, notes]) {
    if (candidate && !isStoryHeavyDescription(candidate) && !LIKELY_NARRATIVE_BEAT.test(candidate)) {
      return clip(candidate)
    }
  }

  if (role && !isStoryHeavyDescription(role) && !LIKELY_NARRATIVE_BEAT.test(role)) {
    return clip(role)
  }

  if (hasPortrait) {
    return CREATOR_FALLBACK_WITH_PORTRAIT
  }

  return CREATOR_FALLBACK_NO_PORTRAIT
}

/** One cast-bible / character-lock line with name token. */
export function formatCastLineForProductionPrompt (input: CharacterVisualPromptInput): string {
  const visual = resolveCharacterVisualDescription(input)
  const hasPortrait = Boolean((input.portraitUrl || '').trim())
  const line = `${formatCastNameForPrompt(input.name)}: ${visual}`
  if (hasPortrait && !/reference portrait|attached reference/i.test(visual)) {
    return `${line} (Featured portrait attached for this character — match that image exactly.)`
  }
  return line
}
