export interface OmdbMovie {
  title: string
  year?: string
  imdbId?: string
  genre?: string
  director?: string
  actors?: string
  plot?: string
  poster?: string
  imdbRating?: string
  rottenTomatoes?: string
  metascore?: string
}

function normalizeHeadingLine (raw: string): string {
  return raw
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\*\*|\*\*$/g, '')
    .replace(/\*+/g, '')
    .trim()
}

function cleanTitle (s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function pushUniqueTitle (
  out: Array<{ title: string, year?: string }>,
  titleRaw: string,
  year?: string
) {
  const title = cleanTitle(titleRaw)
  if (title.length < 2) return
  if (/^(use these|theme exploration|imported script)/i.test(title)) return
  if (!out.some(x => x.title.toLowerCase() === title.toLowerCase())) {
    out.push({ title, ...(year ? { year } : {}) })
  }
}

/**
 * Parse "Comparable films" from imported treatment notes:
 * 1. Film Title (2016)
 *
 * Also tolerates markdown headings, optional colons, and slightly loose numbering
 * so OMDb lookups still run when the model formats the block differently.
 */
export function extractComparableTitlesFromTreatment (treatment: string): Array<{ title: string, year?: string }> {
  const out: Array<{ title: string, year?: string }> = []
  if (!treatment) return out
  const lines = treatment.split('\n')
  let inComparable = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const head = normalizeHeadingLine(line)
    if (/^Comparable films\b/i.test(head)) {
      inComparable = true
      continue
    }
    if (!inComparable) continue
    if (/^Theme exploration\b/i.test(head)) break
    const m = line.match(/^\d+\.\s*(.+?)(?:\s+\((\d{4})\))?\s*$/)
    if (!m) continue
    pushUniqueTitle(out, m[1] || '', m[2] || undefined)
    if (out.length >= 8) break
  }
  if (out.length) return out.slice(0, 8)

  // Fallback: numbered reference lines anywhere in the treatment (models sometimes skip the exact header).
  for (const raw of lines) {
    const line = raw.trim()
    const m = line.match(/^\d+\.\s*(.+?)(?:\s+\((\d{4})\))?\s*$/)
    if (!m) continue
    const cand = cleanTitle(m[1] || '')
    if (cand.length < 3) continue
    if (/^(imported script|same structure|each row|posters and)/i.test(cand)) continue
    pushUniqueTitle(out, m[1] || '', m[2] || undefined)
    if (out.length >= 8) break
  }
  return out.slice(0, 8)
}

export async function fetchOmdbMovie (params: { apiKey: string, title: string, year?: string }): Promise<OmdbMovie | null> {
  const q = new URLSearchParams({
    apikey: params.apiKey,
    t: params.title,
    plot: 'short',
    r: 'json',
    type: 'movie'
  })
  if (params.year) q.set('y', params.year)
  const url = `https://www.omdbapi.com/?${q.toString()}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json() as Record<string, unknown>
  if (String(data.Response || 'False') !== 'True') return null
  const ratings = Array.isArray(data.Ratings) ? data.Ratings as Array<{ Source?: string, Value?: string }> : []
  const rt = ratings.find(r => String(r.Source || '').toLowerCase().includes('rotten'))?.Value
  return {
    title: String(data.Title || params.title),
    year: String(data.Year || ''),
    imdbId: String(data.imdbID || ''),
    genre: String(data.Genre || ''),
    director: String(data.Director || ''),
    actors: String(data.Actors || ''),
    plot: String(data.Plot || ''),
    poster: String(data.Poster || ''),
    imdbRating: String(data.imdbRating || ''),
    rottenTomatoes: rt || '',
    metascore: String(data.Metascore || '')
  }
}
