import type { CreativeScript, CreativeScriptStatus } from '~/types/creative-script'

const VALID_STATUS = new Set<CreativeScriptStatus>(['draft', 'in_progress', 'final'])

function parseStatus (v: unknown): CreativeScriptStatus {
  if (typeof v === 'string' && VALID_STATUS.has(v as CreativeScriptStatus)) {
    return v as CreativeScriptStatus
  }
  return 'draft'
}

function parseComparableTitles (v: unknown): Array<{ title: string; year?: string }> {
  if (!Array.isArray(v)) return []
  const out: Array<{ title: string; year?: string }> = []
  for (const row of v) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const title = String(o.title || '').trim()
    const year = String(o.year || '').trim()
    if (!title) continue
    out.push({ title, year: year || undefined })
  }
  return out.slice(0, 12)
}

export function pbRecordToCreativeScript (raw: Record<string, unknown>): CreativeScript {
  const themesRaw = raw.themes
  const themes = Array.isArray(themesRaw)
    ? themesRaw.map(t => String(t || '').trim()).filter(Boolean).slice(0, 20)
    : []

  return {
    id: String(raw.id || ''),
    title: String(raw.title || ''),
    status: parseStatus(raw.status),
    sourceFilename: String(raw.source_filename || ''),
    scriptText: String(raw.script_text || ''),
    synopsis: String(raw.synopsis || ''),
    treatment: String(raw.treatment || ''),
    genre: String(raw.genre || ''),
    tone: String(raw.tone || ''),
    themes,
    comparableTitles: parseComparableTitles(raw.comparable_titles),
    created: String(raw.created || ''),
    updated: String(raw.updated || '')
  }
}

