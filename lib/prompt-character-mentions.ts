import {
  formatCastNameForPrompt,
  isSpeciesLikeCastName,
  normalizeCharacterNameKey
} from '~/lib/cast-name-convention'

export type PromptCharacterCastMember = {
  id: string
  name: string
  portraitUrl?: string | null
  plateUrls?: string[]
}

export type PromptCharacterMention = {
  start: number
  end: number
  characterId: string
  name: string
  matchedText: string
}

export type PromptMentionSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; text: string; mention: PromptCharacterMention }

function escapeRegExp (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rangesOverlap (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Locate cast-name tokens in prompt text (same matching rules as cast continuity).
 * Longer names win when ranges overlap.
 */
export function findPromptCharacterMentions (
  text: string,
  cast: PromptCharacterCastMember[]
): PromptCharacterMention[] {
  if (!text || !cast.length) return []

  const sorted = [...cast].sort((a, b) => b.name.trim().length - a.name.trim().length)
  const mentions: PromptCharacterMention[] = []

  for (const c of sorted) {
    const key = normalizeCharacterNameKey(c.name)
    if (!key) continue
    const caps = formatCastNameForPrompt(c.name)
    const patterns: RegExp[] = [new RegExp(`\\b${escapeRegExp(caps)}\\b`, 'g')]
    if (!isSpeciesLikeCastName(c.name)) {
      patterns.push(new RegExp(`\\b${escapeRegExp(key)}\\b`, 'gi'))
    }

    for (const re of patterns) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) != null) {
        const start = m.index
        const matchedText = m[0]
        const end = start + matchedText.length
        if (!matchedText) {
          re.lastIndex = start + 1
          continue
        }
        if (mentions.some(ex => rangesOverlap(start, end, ex.start, ex.end))) continue
        mentions.push({
          start,
          end,
          characterId: c.id,
          name: c.name.trim(),
          matchedText
        })
      }
    }
  }

  return mentions.sort((a, b) => a.start - b.start || b.end - a.end)
}

export function segmentPromptWithCharacterMentions (
  text: string,
  cast: PromptCharacterCastMember[]
): PromptMentionSegment[] {
  const mentions = findPromptCharacterMentions(text, cast)
  if (!mentions.length) {
    return text ? [{ type: 'text', text }] : []
  }

  const segments: PromptMentionSegment[] = []
  let cursor = 0
  for (const mention of mentions) {
    if (mention.start > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, mention.start) })
    }
    segments.push({
      type: 'mention',
      text: text.slice(mention.start, mention.end),
      mention
    })
    cursor = mention.end
  }
  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) })
  }
  return segments
}

/** Featured plate first, then turnarounds. */
export function resolveCharacterMentionPreviewUrl (
  character: PromptCharacterCastMember | null | undefined
): string | null {
  if (!character) return null
  const featured = (character.portraitUrl || '').trim()
  if (featured) return featured
  const plate = (character.plateUrls || []).map(u => (u || '').trim()).find(Boolean)
  return plate || null
}
