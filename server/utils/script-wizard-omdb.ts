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

function cleanTitle (s: string): string {
  return s
    .replace(/\(\d{4}\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse "Comparable films" from imported treatment notes:
 * 1. Film Title (2016)
 */
export function extractComparableTitlesFromTreatment (treatment: string): Array<{ title: string, year?: string }> {
  const out: Array<{ title: string, year?: string }> = []
  if (!treatment) return out
  const lines = treatment.split('\n')
  let inComparable = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (/^Comparable films$/i.test(line)) {
      inComparable = true
      continue
    }
    if (!inComparable) continue
    if (/^Theme exploration$/i.test(line)) break
    const m = line.match(/^\d+\.\s+(.+?)(?:\s+\((\d{4})\))?$/)
    if (!m) continue
    const title = cleanTitle(m[1] || '')
    if (!title) continue
    const year = m[2] || undefined
    if (!out.some(x => x.title.toLowerCase() === title.toLowerCase())) {
      out.push({ title, year })
    }
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
