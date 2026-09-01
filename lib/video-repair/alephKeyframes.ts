/**
 * Seconds at which to pin the same reference image for Aleph.
 * A single start keyframe often holds for frame 0 then drifts back to the source look;
 * start + mid + end keeps the correction anchored across the clip.
 *
 * Aleph rejects any keyframe with seconds > input video duration. Client metadata
 * often overstates length (e.g. requested 5s, encoded 3s), so multi-pin only when
 * `durationTrusted` is true (server-probed). Otherwise pin start only.
 */
export function alephKeyframePinSeconds (
  durationSeconds?: number | null,
  opts?: { durationTrusted?: boolean }
): number[] {
  const trusted = opts?.durationTrusted === true
  const d =
    typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : 0
  // Without a trusted duration, only pin frame 0 — mid/end from inflated metadata 502s Aleph.
  if (!trusted || d <= 0) return [0]

  const round2 = (n: number) => Math.round(n * 100) / 100
  // Stay strictly inside the clip (Aleph: timestamp must be at most duration).
  const maxSec = round2(Math.max(0, d - 0.01))
  if (maxSec <= 0) return [0]
  if (d < 1.5) return [...new Set([0, maxSec])].sort((a, b) => a - b)
  const mid = round2(Math.min(d / 2, maxSec))
  return [...new Set([0, mid, maxSec])].sort((a, b) => a - b)
}

export type AlephKeyframe = { uri: string; seconds: number }

/** Build Runway `keyframes` passthrough entries from one HTTPS reference URI. */
export function buildAlephKeyframeEntries (
  uri: string,
  durationSeconds?: number | null,
  opts?: { durationTrusted?: boolean }
): AlephKeyframe[] {
  const clean = (uri || '').trim()
  if (!clean || !/^https:\/\//i.test(clean)) return []
  return alephKeyframePinSeconds(durationSeconds, opts).map(seconds => ({ uri: clean, seconds }))
}
