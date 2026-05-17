/** Normalize a name for screenplay cue lines (ALL CAPS, no parentheticals on cue). */
export function normalizeScreenplayCharacterName (raw: string): string {
  const s = String(raw || '')
    .trim()
    .replace(/\s*\([^)]*\)\s*$/u, '')
    .replace(/[.:]+$/u, '')
    .trim()
  if (!s) return ''
  return s.toUpperCase().slice(0, 40)
}

export function sanitizeCharacterNameList (names: unknown): string[] {
  if (!Array.isArray(names)) return []
  const out: string[] = []
  for (const n of names) {
    const norm = normalizeScreenplayCharacterName(String(n || ''))
    if (norm.length < 2) continue
    if (out.includes(norm)) continue
    out.push(norm)
    if (out.length >= 12) break
  }
  return out
}

export const SCREENPLAY_AI_FORMAT_RULES = `Write in plain-text screenplay format:
- Start with a CAST section listing every speaking character (name in ALL CAPS, em dash, one-line description).
- Use standard slug lines: INT. or EXT. LOCATION - TIME
- Put each CHARACTER NAME alone on its own line in ALL CAPS immediately before their dialogue.
- Action lines in sentence case; no markdown or code fences.
- Include at least 3 scenes and dialogue for every named character in CAST.
- Do not use "OTHER (extras)" as a character name — name specific roles instead.`

export function buildCastSection (
  characters: Array<{ name: string; description?: string }>
): string {
  const lines = ['CAST', '']
  for (const c of characters) {
    const name = normalizeScreenplayCharacterName(c.name)
    if (!name) continue
    const desc = (c.description || '').trim() || 'Speaking role.'
    lines.push(`${name} — ${desc}`)
  }
  return lines.join('\n').trim()
}

/**
 * Minimal screenplay skeleton when AI is unavailable — still parseable for cast/scenes.
 */
export function buildFallbackScreenplayDraft (input: {
  title: string
  logline?: string
  summary: string
  characters: Array<{ name: string; description?: string }>
}): string {
  const title = input.title.trim().toUpperCase() || 'UNTITLED'
  const cast = buildCastSection(input.characters)
  const names = input.characters
    .map(c => normalizeScreenplayCharacterName(c.name))
    .filter(Boolean)
  const lead = names[0] || 'HERO'
  const second = names[1] || names[0] || 'ALLY'

  const summaryPara = input.summary.trim().replace(/\s+/g, ' ')
  const actionBeat = summaryPara.slice(0, 220) || 'The story begins.'

  return [
    title,
    '',
    input.logline ? `LOGLINE: ${input.logline.trim()}` : '',
    '',
    cast,
    '',
    '---',
    '',
    'FADE IN:',
    '',
    'INT. HOME - DAY',
    '',
    actionBeat,
    '',
    lead,
    'This is where it starts.',
    '',
    second,
    'And this is how we answer.',
    '',
    'INT. NEIGHBORHOOD - LATER',
    '',
    'The situation escalates.',
    '',
    lead,
    'We have to try.',
    '',
    'EXT. STREET - SUNSET',
    '',
    'A quiet resolution.',
    '',
    lead,
    'Together, then.',
    '',
    'FADE OUT.',
    '',
    'THE END'
  ]
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')
    .trim()
}
