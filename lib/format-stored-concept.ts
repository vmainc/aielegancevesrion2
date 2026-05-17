const CHARACTERS_MARKER_RE = /<!--\s*aielegance:characters=(\[.*?\])\s*-->/s
const DURATION_MARKER_RE = /<!--\s*aielegance:duration=(\d+)\s*-->/i

export function upsertDurationInConceptNotes (notes: string, seconds: number | null): string {
  const stripped = (notes || '').replace(DURATION_MARKER_RE, '').trimStart()
  if (seconds == null || !Number.isFinite(seconds) || seconds < 15) {
    return stripped
  }
  const n = Math.floor(seconds)
  return `<!-- aielegance:duration=${n} -->\n${stripped}`.trim()
}

export function parseDurationFromConceptNotes (notes: string): number | undefined {
  const m = DURATION_MARKER_RE.exec(notes || '')
  if (!m?.[1]) return undefined
  const n = Math.floor(Number(m[1]))
  if (!Number.isFinite(n) || n < 15 || n > 3600) return undefined
  return n
}

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
