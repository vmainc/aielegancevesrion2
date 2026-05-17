import { snapDurationToModelSupported } from '~/lib/storyboard-video-duration'

type VideosModelsPayload = {
  data?: Array<{ id?: string; supported_durations?: unknown }>
}

let cache: { at: number; byId: Map<string, number[]> } | null = null
const TTL_MS = 10 * 60 * 1000

function parseSupported (raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  for (const x of raw) {
    const n = typeof x === 'number' ? x : Number(x)
    if (Number.isFinite(n) && n > 0) out.push(Math.floor(n))
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

/**
 * OpenRouter `GET /api/v1/videos/models` (public) lists `supported_durations` per model id.
 * Cached briefly to avoid hammering the catalog on each video job.
 */
export async function getOpenRouterVideoModelSupportedDurations (modelId: string): Promise<number[] | null> {
  const id = modelId.trim()
  if (!id) return null

  const now = Date.now()
  if (!cache || now - cache.at > TTL_MS) {
    const res = await fetch('https://openrouter.ai/api/v1/videos/models', {
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) {
      return null
    }
    let json: VideosModelsPayload
    try {
      json = (await res.json()) as VideosModelsPayload
    } catch {
      return null
    }
    const byId = new Map<string, number[]>()
    for (const row of json.data || []) {
      const mid = typeof row.id === 'string' ? row.id.trim() : ''
      const sd = parseSupported(row.supported_durations)
      if (mid && sd.length) byId.set(mid, sd)
    }
    cache = { at: now, byId }
  }

  return cache!.byId.get(id) ?? null
}

export function snapVideoDurationToOpenRouterModel (
  requestedSeconds: number,
  supported: number[] | null | undefined
): number {
  const r = Math.max(1, Math.floor(Number(requestedSeconds)))
  if (!supported?.length) return r
  return snapDurationToModelSupported(r, supported)
}
