/**
 * Seconds at which to pin the same reference image for Aleph.
 * A single start keyframe often holds for frame 0 then drifts back to the source look;
 * start + mid + end keeps the correction anchored across the clip.
 */
export function alephKeyframePinSeconds (durationSeconds?: number | null): number[] {
  const d =
    typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : 0
  if (d <= 0) return [0]
  const round2 = (n: number) => Math.round(n * 100) / 100
  if (d < 1.5) return [...new Set([0, round2(d)])].sort((a, b) => a - b)
  const mid = round2(d / 2)
  // Stay slightly inside the clip so the end pin is never past duration.
  const end = round2(Math.max(mid, d - 0.05))
  return [...new Set([0, mid, end])].sort((a, b) => a - b)
}

export type AlephKeyframe = { uri: string; seconds: number }

/** Build Runway `keyframes` passthrough entries from one HTTPS reference URI. */
export function buildAlephKeyframeEntries (
  uri: string,
  durationSeconds?: number | null
): AlephKeyframe[] {
  const clean = (uri || '').trim()
  if (!clean || !/^https:\/\//i.test(clean)) return []
  return alephKeyframePinSeconds(durationSeconds).map(seconds => ({ uri: clean, seconds }))
}
