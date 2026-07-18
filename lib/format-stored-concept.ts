import { WORKFLOW_GENERATE_MARKER, WORKFLOW_IDEA_MARKER, WORKFLOW_SCRATCH_MARKER } from '~/lib/project-workflow-mode'

const CHARACTERS_MARKER_RE = /<!--\s*aielegance:characters=(\[.*?\])\s*-->/s
const DURATION_MARKER_RE = /<!--\s*aielegance:duration=(\d+)\s*-->/gi
const SOURCE_MARKER_RE = /<!--\s*aielegance:source=\w+\s*-->/gi

/** Model/import placeholders that should not show as genre/tone chips. */
export function isPlaceholderGenreOrTone (value: string | null | undefined): boolean {
  const v = String(value || '').trim().toLowerCase()
  if (!v) return true
  return (
    v === 'unknown' ||
    v === 'n/a' ||
    v === 'na' ||
    v === 'none' ||
    v === 'unspecified' ||
    v === 'not specified' ||
    v === 'tbd'
  )
}

export function displayGenreOrTone (value: string | null | undefined): string {
  const raw = String(value || '').trim()
  return isPlaceholderGenreOrTone(raw) ? '' : raw
}

/** Remove embedded metadata markers; leaves user-facing concept text. */
export function stripConceptMetadataMarkers (text: string): string {
  return (text || '')
    .replace(WORKFLOW_IDEA_MARKER, '')
    .replace(WORKFLOW_GENERATE_MARKER, '')
    .replace(WORKFLOW_SCRATCH_MARKER, '')
    .replace(DURATION_MARKER_RE, '')
    .replace(SOURCE_MARKER_RE, '')
    .replace(CHARACTERS_MARKER_RE, '')
    .replace(/^\s*\n+/gm, '\n')
    .trim()
}

export function conceptNotesHaveUserContent (notes: string): boolean {
  return Boolean(stripConceptMetadataMarkers(notes).trim())
}

export function parseDurationFromConceptNotes (notes: string): number | undefined {
  const m = /<!--\s*aielegance:duration=(\d+)\s*-->/i.exec(notes || '')
  if (!m?.[1]) return undefined
  const n = Math.floor(Number(m[1]))
  if (!Number.isFinite(n) || n < 15 || n > 3600) return undefined
  return n
}

/** Embed or replace runtime marker in concept notes (fallback when PB field is missing). */
export function upsertDurationMarkerInConceptNotes (
  notes: string,
  seconds: number | null | undefined
): string {
  const base = stripConceptMetadataMarkers(notes)
  if (seconds == null) return base
  const n = Math.floor(Number(seconds))
  if (!Number.isFinite(n) || n < 15 || n > 3600) return base
  if (!base) return `<!-- aielegance:duration=${n} -->`
  return `<!-- aielegance:duration=${n} -->\n${base}`
}

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

/** Store author-provided story text (skip AI concept generation). */
export function formatUserProvidedConceptNotes (userPrompt: string): string {
  const body = userPrompt.trim()
  if (!body) return ''
  return `<!-- aielegance:source=user -->\n${body}`
}

/** Pick a short working title from freeform prompt text. */
export function deriveTitleFromPrompt (prompt: string, fallback = 'Untitled'): string {
  const line = prompt.trim().split(/\n/)[0]?.trim() || ''
  if (!line) return fallback
  const sentence = (line.split(/[.!?]/)[0] || line).trim()
  return (sentence || line).slice(0, 120) || fallback
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

const SYNOPSIS_JSON_KEYS = [
  'one_page_synopsis',
  'onePageSynopsis',
  'synopsis',
  'full_synopsis',
  'narrative_synopsis',
  'story_synopsis',
  'logline',
  'summary',
  'overview',
  'story',
  'text',
  'content'
] as const

function proseFromUnknownRecord (raw: Record<string, unknown>): string {
  const parts: string[] = []
  const logline = typeof raw.logline === 'string' ? raw.logline.trim() : ''
  if (logline) parts.push(logline)
  for (const key of SYNOPSIS_JSON_KEYS) {
    if (key === 'logline') continue
    const v = raw[key]
    if (typeof v === 'string' && v.trim() && v.trim() !== logline) {
      parts.push(v.trim())
      break
    }
  }
  return parts.join('\n\n').trim()
}

/**
 * Coerce a stored synopsis value into readable prose.
 * Handles accidental JSON blobs (first line often just `{`) and object-shaped PB fields.
 */
export function normalizeSynopsisText (raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return proseFromUnknownRecord(raw as Record<string, unknown>)
  }
  if (typeof raw !== 'string') return ''

  let text = raw.trim()
  if (!text) return ''

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown
      if (typeof parsed === 'string') {
        text = parsed.trim()
      } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const fromObj = proseFromUnknownRecord(parsed as Record<string, unknown>)
        if (fromObj) return fromObj
      }
    } catch {
      /* keep trimmed string */
    }
  }

  // Pretty-printed JSON that failed full parse — still not useful as a card preview.
  if (/^\{\s*$/.test(text) || text === '{' || text === '{}') return ''
  if (/^[\{\[]/.test(text) && /"logline"|"one_page_synopsis"|"synopsis"/i.test(text)) {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1)) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const fromObj = proseFromUnknownRecord(parsed as Record<string, unknown>)
          if (fromObj) return fromObj
        }
      } catch {
        /* fall through */
      }
    }
  }

  return text
}

/** User-facing synopsis for Story / cards — falls back to treatment or concept notes. */
export function displayProjectSynopsis (project: {
  synopsis?: string | null
  treatment?: string | null
  conceptNotes?: string | null
}): string {
  const syn = normalizeSynopsisText(project.synopsis)
  if (syn) return syn

  const treatment = String(project.treatment || '').trim()
  if (treatment) {
    const withoutMarker = treatment
      .replace(/^Script analysis \(cold read\)\s*/i, '')
      .replace(/^Imported script[^\n]*\n*/i, '')
      .trim()
    // Prefer thematic / narrative paragraphs over bare headings.
    const paragraphs = withoutMarker
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(p => p && !/^#{1,3}\s/.test(p) && !/^(act\s*[123]|themes?)\b/i.test(p))
    if (paragraphs[0] && paragraphs[0].length >= 40) return paragraphs.join('\n\n')
  }

  const logline = parseLoglineFromConceptNotes(project.conceptNotes || '')
  if (logline) return logline
  return stripConceptMetadataMarkers(project.conceptNotes || '')
}

/** One- or two-line preview for project cards. */
export function projectSynopsisPreview (
  project: {
    synopsis?: string | null
    treatment?: string | null
    conceptNotes?: string | null
  },
  maxLen = 220
): string {
  const prose = displayProjectSynopsis(project).replace(/\s+/g, ' ').trim()
  if (!prose) return ''
  if (prose.length <= maxLen) return prose
  return `${prose.slice(0, maxLen - 1).trimEnd()}…`
}
