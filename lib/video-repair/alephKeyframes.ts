/**
 * Seconds at which to pin the same reference image for Aleph.
 * A single start keyframe often holds for frame 0 then drifts back to the source look;
 * multiple pins across the clip keep the correction anchored.
 *
 * Aleph rejects any keyframe with seconds > input video duration. Client metadata
 * often overstates length (e.g. requested 5s, encoded 3s). When duration is not
 * ffprobe-trusted, we still multi-pin but never past a conservative 2.99s ceiling
 * (covers typical 3s Seedance clips without 502s).
 */

/** Safe ceiling when duration is untrusted — below common 3s encoded length. */
export const ALEPH_UNTRUSTED_PIN_MAX_SECONDS = 2.99

/** Aleph / Runway allow a small number of keyframe anchors; stay at or under 5. */
const MAX_PINS = 5

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Evenly spaced pins from 0 … maxSec (inclusive), up to MAX_PINS.
 * Short clips get denser holds so a 3s eye fix does not fade after frame 0.
 */
export function alephKeyframePinSeconds (
  durationSeconds?: number | null,
  opts?: { durationTrusted?: boolean }
): number[] {
  const trusted = opts?.durationTrusted === true
  const raw =
    typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : 0

  let maxSec: number
  if (trusted && raw > 0) {
    maxSec = round2(Math.max(0, raw - 0.01))
  } else if (raw > 0) {
    // Untrusted client duration may be inflated — never pin past the safe 3s ceiling.
    maxSec = round2(Math.max(0, Math.min(raw - 0.05, ALEPH_UNTRUSTED_PIN_MAX_SECONDS)))
  } else {
    // No duration at all — absolute pins that fit a typical 3s clip.
    maxSec = ALEPH_UNTRUSTED_PIN_MAX_SECONDS
  }

  if (maxSec <= 0) return [0]
  if (maxSec < 0.5) return [0, maxSec]

  // Denser for short clips (2–5 pins). Longer trusted clips still get start/mid/end+.
  let count: number
  if (maxSec <= 2) count = 3
  else if (maxSec <= 4) count = 5
  else if (maxSec <= 8) count = 4
  else count = 3
  count = Math.min(MAX_PINS, count)

  const pins: number[] = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : round2((maxSec * i) / (count - 1))
    pins.push(Math.min(t, maxSec))
  }
  return [...new Set(pins)].sort((a, b) => a - b)
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
