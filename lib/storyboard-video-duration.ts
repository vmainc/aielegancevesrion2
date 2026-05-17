/** Storyboard / video step: clip length must be one of these (common OpenRouter video SKUs). */
export const STORYBOARD_CLIP_SECONDS = [5, 10] as const
export type StoryboardClipSeconds = (typeof STORYBOARD_CLIP_SECONDS)[number]

/** Map any legacy shot length to 5s or 10s (half-open split at 7.5s). */
export function snapToStoryboardClipSeconds (n: number): StoryboardClipSeconds {
  const x = Number(n)
  if (!Number.isFinite(x)) return 5
  return x <= 7.5 ? 5 : 10
}

/**
 * Pick the closest value in `supported` to `preferred` (e.g. OpenRouter `supported_durations`).
 * Ties break toward the shorter duration (usually cheaper / faster).
 */
export function snapDurationToModelSupported (preferred: number, supported: number[]): number {
  const r = Math.floor(Number(preferred))
  if (!Number.isFinite(r) || r < 1) return supported[0] ?? 5
  const uniq = [...new Set(supported.filter(x => Number.isFinite(x) && x > 0))].sort((a, b) => a - b)
  if (!uniq.length) return Math.max(1, r)
  if (uniq.includes(r)) return r
  let best = uniq[0]!
  for (const s of uniq) {
    const da = Math.abs(s - r)
    const db = Math.abs(best - r)
    if (da < db) best = s
    else if (da === db && s < best) best = s
  }
  return best
}
