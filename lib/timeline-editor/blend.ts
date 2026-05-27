import { clipTimelineEnd } from '~/lib/timeline-editor/geometry'
import { clipsOnTrack } from '~/lib/timeline-editor/clip-ops'
import type { TimelineEditorClip } from '~/types/timeline-editor'

export const DEFAULT_CROSSFADE_SEC = 0.6
export const MIN_CROSSFADE_SEC = 0.15
export const MAX_CROSSFADE_SEC = 2

export function clipTransitionDuration (clip: TimelineEditorClip): number {
  const d = Number(clip.transitionDurationSec)
  if (Number.isFinite(d) && d > 0) return Math.min(MAX_CROSSFADE_SEC, Math.max(MIN_CROSSFADE_SEC, d))
  return DEFAULT_CROSSFADE_SEC
}

/** Active crossfade between outgoing and incoming clip at timeline time `t`. */
export interface TimelineBlendFrame {
  outgoing: TimelineEditorClip
  incoming: TimelineEditorClip
  /** 0 = full outgoing, 1 = full incoming */
  mix: number
  overlapSec: number
}

export function getBlendAtTime (
  clips: TimelineEditorClip[],
  track: TimelineEditorClip['track'],
  t: number
): TimelineBlendFrame | null {
  const ordered = clipsOnTrack(clips, track)
  for (let i = 0; i < ordered.length - 1; i++) {
    const out = ordered[i]!
    const inc = ordered[i + 1]!
    if (out.transitionOut !== 'crossfade' && inc.transitionIn !== 'crossfade') continue
    const overlap = Math.min(clipTransitionDuration(out), clipTransitionDuration(inc))
    const outEnd = clipTimelineEnd(out)
    const overlapStart = inc.timelineStart
    if (overlapStart >= outEnd - 0.02) continue
    const zoneEnd = outEnd
    const zoneStart = overlapStart
    if (t < zoneStart - 0.001 || t > zoneEnd + 0.001) continue
    const span = Math.max(0.05, zoneEnd - zoneStart)
    const mix = Math.max(0, Math.min(1, (t - zoneStart) / span))
    return { outgoing: out, incoming: inc, mix, overlapSec: span }
  }
  return null
}

/** Pair next clip with crossfade overlap (non-destructive metadata). */
export function applyCrossfadeWithNext (
  clips: TimelineEditorClip[],
  clipId: string,
  overlapSec = DEFAULT_CROSSFADE_SEC
): TimelineEditorClip[] {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return clips
  const ordered = clipsOnTrack(clips, clip.track)
  const idx = ordered.findIndex(c => c.id === clipId)
  const next = ordered[idx + 1]
  if (!next) return clips

  const dur = Math.min(
    overlapSec,
    clip.duration * 0.45,
    next.duration * 0.45,
    MAX_CROSSFADE_SEC
  )
  const outEnd = clipTimelineEnd(clip)
  const nextStart = Math.max(0, outEnd - dur)

  return clips.map(c => {
    if (c.id === clip.id) {
      return {
        ...c,
        transitionOut: 'crossfade',
        transitionDurationSec: dur
      }
    }
    if (c.id === next.id) {
      return {
        ...c,
        timelineStart: nextStart,
        transitionIn: 'crossfade',
        transitionDurationSec: dur
      }
    }
    return c
  })
}

export function removeCrossfadeAtJunction (
  clips: TimelineEditorClip[],
  clipId: string
): TimelineEditorClip[] {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return clips
  const ordered = clipsOnTrack(clips, clip.track)
  const idx = ordered.findIndex(c => c.id === clipId)
  const nextClip = ordered[idx + 1]
  if (!nextClip) return clips
  const outEnd = clipTimelineEnd(clip)
  return clips.map(c => {
    if (c.id === clip.id) {
      return { ...c, transitionOut: null, transitionDurationSec: undefined }
    }
    if (c.id === nextClip.id) {
      return {
        ...c,
        timelineStart: outEnd,
        transitionIn: null,
        transitionDurationSec: undefined
      }
    }
    return c
  })
}

export function hasNextClipForBlend (clips: TimelineEditorClip[], clipId: string): boolean {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return false
  const ordered = clipsOnTrack(clips, clip.track)
  const idx = ordered.findIndex(c => c.id === clipId)
  return idx >= 0 && idx < ordered.length - 1
}