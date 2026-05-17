const CHARACTERS_MARKER_RE = /<!--\s*aielegance:characters=(\[.*?\])\s*-->/s

/**
 * Format concept fields for `conceptNotes` when user picks a generated concept.
 */
export function formatStoredConceptNotes (input: {
  title: string
  logline: string
  modelId: string
  modelLabel: string
  characters?: string[]
}): string {
  const { title, logline, modelId, modelLabel, characters } = input
  const castMarker =
    characters?.length
      ? `\n<!-- aielegance:characters=${JSON.stringify(characters)} -->\n`
      : ''
  return `**Title:** ${title}

**Logline:** ${logline}

**Source model:** ${modelLabel} (\`${modelId}\`)
${castMarker}
---

`
}

export function parseLoglineFromConceptNotes (notes: string): string {
  const m = notes.match(/\*\*Logline:\*\*\s*(.+?)(?:\n|$)/i)
  return (m?.[1] || '').trim()
}

export function parseCharactersFromConceptNotes (notes: string): string[] {
  const m = CHARACTERS_MARKER_RE.exec(notes)
  if (!m?.[1]) return []
  try {
    const parsed = JSON.parse(m[1]) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(x => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
      .slice(0, 24)
  } catch {
    return []
  }
}
