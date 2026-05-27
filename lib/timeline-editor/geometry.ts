import { SNAP_THRESHOLD_SEC } from '~/types/timeline-editor'
import type { TimelineEditorClip } from '~/types/timeline-editor'

export function clipTimelineEnd (clip: TimelineEditorClip): number {
  return clip.timelineStart + clip.duration
}

export function totalTimelineDuration (clips: TimelineEditorClip[]): number {
  let max = 0
  for (const c of clips) {
    const end = clipTimelineEnd(c)
    if (end > max) max = end
  }
  return Math.max(max, 1)
}

export function timeToPx (seconds: number, pxPerSec: number): number {
  return seconds * pxPerSec
}

export function pxToTime (px: number, pxPerSec: number): number {
  if (pxPerSec <= 0) return 0
  return Math.max(0, px / pxPerSec)
}

/** Width of the track label column (px); must match timeline editor layout. */
export const TRACK_LABEL_WIDTH = 96

/** Map a pointer position to timeline time (seconds) inside the scroll container. */
export function timeFromClientX (
  clientX: number,
  scrollEl: HTMLElement,
  pxPerSec: number,
  maxDuration?: number
): number {
  const rect = scrollEl.getBoundingClientRect()
  const x = clientX - rect.left + scrollEl.scrollLeft - TRACK_LABEL_WIDTH
  const t = pxToTime(Math.max(0, x), pxPerSec)
  if (maxDuration != null && maxDuration > 0) return Math.min(t, maxDuration)
  return t
}

/** Snap `time` to clip edges on the same track (and 0). */
export function snapTime (
  time: number,
  clips: TimelineEditorClip[],
  track: TimelineEditorClip['track'],
  excludeId?: string
): number {
  const targets = [0]
  for (const c of clips) {
    if (c.track !== track || c.id === excludeId) continue
    targets.push(c.timelineStart, clipTimelineEnd(c))
  }
  let best = time
  let bestDist = SNAP_THRESHOLD_SEC
  for (const t of targets) {
    const d = Math.abs(t - time)
    if (d < bestDist) {
      bestDist = d
      best = t
    }
  }
  return best
}

export function formatTimecode (seconds: number): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`
}
