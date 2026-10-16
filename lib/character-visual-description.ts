import { formatCastNameForPrompt } from '~/lib/cast-name-convention'

export interface CharacterVisualPromptInput {
  name: string
  roleDescription?: string
  /** Locked visual anchor from the character profile — takes priority over role blurb. */
  appearanceDescription?: string
  /** Recurring props, accessories, or tics appended to the cast line. */
  signatureDetails?: string
  /** Never-show list. Signature lines that match it are dropped before prompting. */
  avoidDescription?: string
  portraitUrl?: string | null
  /** Asset notes (Character Creator saves the visual prompt here). */
  portraitNotes?: string
  /** Asset metadata.prompt_used from portrait generation. */
  portraitPromptUsed?: string
  /** When set, clothes come from the costume lock. Face plates must not supply wardrobe. */
  wardrobeLocked?: boolean
}

/** Map cast-member or character-ref shapes into visual prompt input. */
export function castMemberToVisualInput (c: {
  name: string
  roleDescription?: string
  traitsRoleVisual?: string
  appearanceDescription?: string
  signatureDetails?: string
  avoidDescription?: string
  portraitUrl?: string | null
  portraitNotes?: string
  portraitPromptUsed?: string
  wardrobeLocked?: boolean
}): CharacterVisualPromptInput {
  return {
    name: c.name,
    roleDescription: (c.roleDescription ?? c.traitsRoleVisual ?? '').trim() || undefined,
    appearanceDescription: (c.appearanceDescription || '').trim() || undefined,
    signatureDetails: (c.signatureDetails || '').trim() || undefined,
    avoidDescription: (c.avoidDescription || '').trim() || undefined,
    portraitUrl: c.portraitUrl,
    portraitNotes: c.portraitNotes,
    portraitPromptUsed: c.portraitPromptUsed,
    wardrobeLocked: c.wardrobeLocked
  }
}

function collectBanItems (avoid: string, appearance: string): string[] {
  const items: string[] = []
  const push = (raw: string) => {
    const t = raw
      .trim()
      .toLowerCase()
      .replace(/^(no|never|without)\s+/, '')
      .replace(/[.:]+$/g, '')
      .trim()
    if (t.length >= 3) items.push(t)
  }
  for (const part of avoid.split(/[\n,;]+/)) push(part)
  for (const match of appearance.matchAll(/\b(?:no|never|without)\s+([a-z][a-z0-9' -]{2,48})/gi)) {
    push(match[1] || '')
  }
  return items
}

function lineContradictsBan (line: string, items: string[]): boolean {
  const lineWords = new Set(
    line.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  )
  for (const item of items) {
    const words = item.split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    if (!words.length) continue
    const hit = words.filter((w) => lineWords.has(w)).length
    if (words.length === 1) {
      if (hit === 1) return true
      continue
    }
    if (hit >= 2 && hit >= Math.ceil(words.length * 0.6)) return true
  }
  return false
}

/** Drop key-item lines that repeat something appearance or never-show already bans. */
export function signatureLinesThatAgree (
  signature: string,
  avoid: string,
  appearance: string
): string {
  const items = collectBanItems(avoid, appearance)
  const lines = signature.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  if (!items.length) return lines.join('\n')
  return lines.filter((line) => !lineContradictsBan(line, items)).join('\n')
}

const STORY_HEAVY =
  /\b(protagonist|antagonist|misadventure|story arc|throughout the (film|story|comedy|spot)|sole protagonist|this comedy|the narrative|character who|experiences a|journey through|falling in while|struggles to get out|regaining (her|his|their) composure|leading to (her|his|their)|seeking attention|playfully leaps?|engaging with|leaps? over|interacts? with)\b/i

const VISUAL_SIGNAL =
  /\b(fur|coat|markings|pattern|whiskers|paws|snout|ears|tail|tabby|calico|breed|species|wardrobe|outfit|wearing|dressed|palette|anime|illustration|photoreal|3d render|cel[\s-]?shaded|build|stocky|slender|fluffy|short hair|eye color|orange|gray|grey|white|black|brown|golden retriever|retriever)\b/i

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
      /\b(who is the|they experience|before regaining|after (the|a)|leading to|who playfully|seeking attention|engaging with|leaps? over)\b/i.test(
        t
      )
    return ploty
  }
  // Action involving another ALL-CAPS cast token often means a scene beat, not a look sheet.
  if (/\b[A-Z]{2,20}\b/.test(t) && /\b(leaps?|engages?|chases?|plays?|with the|over the)\b/i.test(t)) {
    return true
  }
  return false
}

/** Best visual text for production prompts (prefers appearance anchor, then portrait notes / image prompts). */
export function resolveCharacterVisualDescription (input: CharacterVisualPromptInput): string {
  const appearance = (input.appearanceDescription || '').trim()
  const role = (input.roleDescription || '').trim()
  const notes = (input.portraitNotes || '').trim()
  const promptUsed = (input.portraitPromptUsed || '').trim()
  const signature = signatureLinesThatAgree(
    input.signatureDetails || '',
    input.avoidDescription || '',
    input.appearanceDescription || ''
  )
  const hasPortrait = Boolean((input.portraitUrl || '').trim())

  const withSignature = (base: string): string => {
    const b = base.trim()
    if (!b) return signature ? `Signature: ${signature}` : ''
    return signature ? `${b} Signature details: ${signature}` : b
  }

  // Explicit appearance anchor from character profile — highest priority for continuity.
  if (appearance) {
    let base = appearance
    if (input.wardrobeLocked) {
      base = `${base} Ignore any clothing in this description. Lock face, hair, age, and body only.`
      if (hasPortrait) {
        base = `${base} Match the attached character plate(s) for face and body. Do not copy clothes from those plates.`
      }
    } else if (hasPortrait && !/reference portrait|attached reference/i.test(base)) {
      base = `${base} Match the attached reference plate(s) exactly for face, proportions, and wardrobe.`
    }
    return withSignature(base)
  }

  for (const candidate of [promptUsed, notes]) {
    if (candidate && !isStoryHeavyDescription(candidate)) return withSignature(candidate)
  }

  if (role && !isStoryHeavyDescription(role)) return withSignature(role)

  if (promptUsed) return withSignature(promptUsed)
  if (notes) return withSignature(notes)

  if (hasPortrait) {
    const storyHint = role && isStoryHeavyDescription(role)
      ? ` Story context (do not redraw as a generic animal): ${role.slice(0, 400)}`
      : ''
    const base = [
      `VISUAL LOCK: Match the attached reference plate(s) for ${formatCastNameForPrompt(input.name)} exactly.`,
      'Reproduce species, face shape, fur/feather/skin materials, markings, colors, proportions, and wardrobe from the reference image — not a stock or generic animal.',
      storyHint
    ]
      .filter(Boolean)
      .join(' ')
    return withSignature(base)
  }

  const fallback = role || 'Use the established design from the cast bible and any saved portraits.'
  return withSignature(fallback)
}

const LIKELY_NARRATIVE_BEAT =
  /\b(accidentally\s+falls|with a splash|paddles|underwater|then emerges|remarks about|the mishap|approaches the (water|pond|edge)|explores a tranquil|climbs out|wide-eyed curiosity|playfully leaps?|leaps? over|seeking attention|engaging with|lighthearted manner)\b/i

/** Plot pivots — keep the opening phrase before these (often species + vibe, not the beat). */
const NARRATIVE_PIVOT =
  /\b(who\s+(explores|approaches|falls|experiences|discovers|watches|accidentally|playfully|eagerly|proudly|leaps|jumps|chases|engages|seeks)|,\s*the\s+\w+\s+(approaches|falls|paddles|leaps)|accidentally\b|with a splash|paddles\b|then emerges|makes lighthearted|leading to|seeking attention|engaging with|leaps? over)\b/i

/** Legacy meta copy we used to put in the URL — never prefill this again. */
const CREATOR_META_INSTRUCTION =
  /physical appearance only|skip story beats|featured portrait is saved for this character/i

/** Short species/type line from the cast name when the role blurb is pure plot. */
export function nameBasedVisualStub (name: string): string {
  const n = (name || '').trim()
  if (!n) return ''
  const lower = n.toLowerCase()
  if (/\bkitten|kitty\b/.test(lower)) {
    return 'Young domestic kitten — fluffy, wide-eyed; add fur color, markings, and outfit.'
  }
  if (/\bcat|feline|tabby|calico\b/.test(lower)) {
    return 'Domestic cat — fur pattern, eye color, build, and outfit.'
  }
  if (/\bpuppy|pup\b|dog|hound\b/.test(lower)) {
    return 'Dog — breed look, coat color, size, and collar or outfit.'
  }
  if (/\bbunny|rabbit|hare\b/.test(lower)) {
    return 'Rabbit — fur color, ear shape, and outfit.'
  }
  if (/\bbird|owl|parrot|duck|goose\b/.test(lower)) {
    return 'Bird — species, plumage colors, and proportions.'
  }
  if (/\b(child|boy|girl|kid|teen|woman|man|person|human)\b/.test(lower)) {
    return `${n} — age, build, skin tone, hair, face, and clothing for a portrait.`
  }
  return `${n} — species or type, face, body, colors, markings, and clothing.`
}

/** Trim a story-heavy role_description to an appearance-oriented opening (before the first plot beat). */
export function extractVisualBriefFromNarrative (role: string, name: string): string {
  let t = role.trim()
  if (!t) return nameBasedVisualStub(name)

  const pivot = t.search(NARRATIVE_PIVOT)
  if (pivot > 16) {
    t = t.slice(0, pivot).trim()
  }
  t = t.replace(/\s+who\s+(explores|is|was|are|experiences|discovers).+$/i, '').trim()
  t = t.replace(/[,.\s]+$/, '').trim()

  if (t.length >= 8 && !LIKELY_NARRATIVE_BEAT.test(t)) {
    return t
  }

  return nameBasedVisualStub(name)
}

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

  const clip = (s: string) => {
    const out = s.trim()
    if (!out || CREATOR_META_INSTRUCTION.test(out)) return ''
    return out.length <= max ? out : `${out.slice(0, max).trimEnd()}…`
  }

  for (const candidate of [promptUsed, notes]) {
    if (candidate && !isStoryHeavyDescription(candidate) && !LIKELY_NARRATIVE_BEAT.test(candidate)) {
      const c = clip(candidate)
      if (c) return c
    }
  }

  if (role && !isStoryHeavyDescription(role) && !LIKELY_NARRATIVE_BEAT.test(role)) {
    const c = clip(role)
    if (c) return c
  }

  if (role) {
    const extracted = clip(extractVisualBriefFromNarrative(role, input.name))
    if (extracted) return extracted
  }

  if (hasPortrait) {
    return ''
  }

  return clip(nameBasedVisualStub(input.name))
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
