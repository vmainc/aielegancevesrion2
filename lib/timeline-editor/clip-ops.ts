import { clipTimelineEnd, snapTime } from '~/lib/timeline-editor/geometry'
import {
  DEFAULT_CLIP_DURATION,
  MIN_CLIP_DURATION,
  type TimelineEditorClip,
  type TimelineEditorTrack,
  type TimelineTransitionType
} from '~/types/timeline-editor'

export function newTimelineClipId (): string {
  return `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export function clipsOnTrack (
  clips: TimelineEditorClip[],
  track: TimelineEditorTrack
): TimelineEditorClip[] {
  return clips
    .filter(c => c.track === track)
    .sort((a, b) => a.timelineStart - b.timelineStart)
}

export function normalizeTrackLayout (clips: TimelineEditorClip[], track: TimelineEditorTrack): TimelineEditorClip[] {
  const ordered = clipsOnTrack(clips, track)
  let cursor = 0
  const positions = new Map<string, number>()
  for (const c of ordered) {
    const start = Math.max(c.timelineStart, cursor)
    positions.set(c.id, start)
    cursor = start + c.duration
  }
  return clips.map(c => {
    if (c.track !== track) return c
    const timelineStart = positions.get(c.id) ?? c.timelineStart
    return { ...c, timelineStart }
  })
}

function trackHasCrossfadeOverlaps (clips: TimelineEditorClip[], track: TimelineEditorTrack): boolean {
  return clipsOnTrack(clips, track).some(
    c => c.transitionOut === 'crossfade' || c.transitionIn === 'crossfade'
  )
}

export function moveClipOnTrack (
  clips: TimelineEditorClip[],
  clipId: string,
  newTimelineStart: number
): TimelineEditorClip[] {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return clips
  const snapped = snapTime(newTimelineStart, clips, clip.track, clipId)
  const next = clips.map(c =>
    c.id === clipId ? { ...c, timelineStart: Math.max(0, snapped) } : c
  )
  if (trackHasCrossfadeOverlaps(next, clip.track)) return next
  return normalizeTrackLayout(next, clip.track)
}

export function trimClipLeft (
  clips: TimelineEditorClip[],
  clipId: string,
  deltaTimelineSec: number
): TimelineEditorClip[] {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return clips
  const delta = Math.max(-clip.duration + MIN_CLIP_DURATION, Math.min(deltaTimelineSec, clip.duration - MIN_CLIP_DURATION))
  const newSourceStart = clip.sourceStart + delta
  const newDuration = clip.duration - delta
  const newTimelineStart = clip.timelineStart + delta
  return clips.map(c =>
    c.id === clipId
      ? {
          ...c,
          sourceStart: newSourceStart,
          sourceEnd: newSourceStart + newDuration,
          duration: newDuration,
          timelineStart: newTimelineStart
        }
      : c
  )
}

export function trimClipRight (
  clips: TimelineEditorClip[],
  clipId: string,
  deltaTimelineSec: number
): TimelineEditorClip[] {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return clips
  const delta = Math.max(-clip.duration + MIN_CLIP_DURATION, Math.min(deltaTimelineSec, clip.duration - MIN_CLIP_DURATION))
  const newDuration = clip.duration + delta
  const next = clips.map(c =>
    c.id === clipId
      ? {
          ...c,
          sourceEnd: c.sourceStart + newDuration,
          duration: newDuration
        }
      : c
  )
  return normalizeTrackLayout(next, clip.track)
}

function splitOffsetValid (local: number, duration: number): boolean {
  return local > MIN_CLIP_DURATION && local < duration - MIN_CLIP_DURATION
}

/** True when playhead is inside clip (and linked partner, if any). */
export function canSplitClipAtPlayhead (
  clips: TimelineEditorClip[],
  clipId: string,
  playheadSec: number
): boolean {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return false
  const local = playheadSec - clip.timelineStart
  if (!splitOffsetValid(local, clip.duration)) return false

  const video = clip.type === 'video' ? clip : clips.find(c => c.id === clip.linkedVideoId)
  const audio = clip.type === 'audio' ? clip : clips.find(c => c.id === clip.linkedAudioId)
  if (video && audio && video.linkedAudioId === audio.id && audio.linkedVideoId === video.id) {
    const localA = playheadSec - audio.timelineStart
    return splitOffsetValid(localA, audio.duration)
  }
  return true
}

function splitSingleClipAtPlayhead (
  clips: TimelineEditorClip[],
  clip: TimelineEditorClip,
  playheadSec: number
): TimelineEditorClip[] {
  const local = playheadSec - clip.timelineStart
  if (!splitOffsetValid(local, clip.duration)) return clips

  const splitSource = clip.sourceStart + local
  const first: TimelineEditorClip = {
    ...clip,
    sourceEnd: splitSource,
    duration: local,
    transitionOut: null
  }
  const second: TimelineEditorClip = {
    ...clip,
    id: newTimelineClipId(),
    sourceStart: splitSource,
    timelineStart: clip.timelineStart + local,
    duration: clip.duration - local,
    transitionIn: null,
    linkedAudioId: undefined,
    linkedVideoId: undefined
  }
  const rest = clips.filter(c => c.id !== clip.id)
  return normalizeTrackLayout([...rest, first, second], clip.track)
}

function splitLinkedPairAtPlayhead (
  clips: TimelineEditorClip[],
  video: TimelineEditorClip,
  audio: TimelineEditorClip,
  playheadSec: number
): TimelineEditorClip[] {
  const local = playheadSec - video.timelineStart
  if (!splitOffsetValid(local, video.duration)) return clips
  const localA = playheadSec - audio.timelineStart
  if (!splitOffsetValid(localA, audio.duration)) return clips

  const splitAt = video.sourceStart + local
  const v2Id = newTimelineClipId()
  const a2Id = newTimelineClipId()

  const v1: TimelineEditorClip = {
    ...video,
    sourceEnd: splitAt,
    duration: local,
    linkedAudioId: audio.id,
    transitionOut: null
  }
  const v2: TimelineEditorClip = {
    ...video,
    id: v2Id,
    sourceStart: splitAt,
    sourceEnd: video.sourceEnd,
    timelineStart: video.timelineStart + local,
    duration: video.duration - local,
    hasAudio: false,
    linkedAudioId: a2Id,
    transitionIn: null
  }
  const a1: TimelineEditorClip = {
    ...audio,
    sourceEnd: splitAt,
    duration: local,
    linkedVideoId: video.id,
    transitionOut: null
  }
  const a2: TimelineEditorClip = {
    ...audio,
    id: a2Id,
    sourceStart: splitAt,
    sourceEnd: audio.sourceEnd,
    timelineStart: audio.timelineStart + local,
    duration: audio.duration - local,
    linkedVideoId: v2Id,
    transitionIn: null
  }

  let next = clips.filter(c => c.id !== video.id && c.id !== audio.id)
  next = [...next, v1, v2, a1, a2]
  next = normalizeTrackLayout(next, 'video')
  next = normalizeTrackLayout(next, 'audio')
  return next
}

/** Clamp pointer time to a splittable point inside clip (or linked pair). */
export function clampCutTimeForClip (
  clips: TimelineEditorClip[],
  clipId: string,
  pointerTimeSec: number
): number | null {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return null

  const video = clip.type === 'video' ? clip : clips.find(c => c.id === clip.linkedVideoId)
  const audio = clip.type === 'audio' ? clip : clips.find(c => c.id === clip.linkedAudioId)
  const anchor = video ?? clip

  const cut = Math.min(
    anchor.timelineStart + anchor.duration - MIN_CLIP_DURATION,
    Math.max(anchor.timelineStart + MIN_CLIP_DURATION, pointerTimeSec)
  )

  return canSplitClipAtPlayhead(clips, clipId, cut) ? cut : null
}

/** Clip ids to cut at timeline time `t` (one entry per video / standalone clip). */
export function clipIdsToCutAtTime (clips: TimelineEditorClip[], t: number): string[] {
  const ids: string[] = []
  for (const c of clips) {
    if (c.linkedVideoId) continue
    const local = t - c.timelineStart
    if (!splitOffsetValid(local, c.duration)) continue
    if (c.linkedAudioId) {
      const audio = clips.find(x => x.id === c.linkedAudioId)
      if (audio) {
        const localA = t - audio.timelineStart
        if (!splitOffsetValid(localA, audio.duration)) continue
      }
    }
    ids.push(c.id)
  }
  return ids.sort((a, b) => {
    const ca = clips.find(c => c.id === a)!
    const cb = clips.find(c => c.id === b)!
    return ca.timelineStart - cb.timelineStart
  })
}

export function splitResultChanged (
  before: TimelineEditorClip[],
  after: TimelineEditorClip[]
): boolean {
  if (after.length !== before.length) return true
  const beforeIds = new Set(before.map(c => c.id))
  return after.some(c => !beforeIds.has(c.id))
}

export function splitClipAtPlayhead (
  clips: TimelineEditorClip[],
  clipId: string,
  playheadSec: number
): TimelineEditorClip[] {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return clips

  const video = clip.type === 'video' ? clip : clips.find(c => c.id === clip.linkedVideoId)
  const audio = clip.type === 'audio' ? clip : clips.find(c => c.id === clip.linkedAudioId)
  if (
    video &&
    audio &&
    video.linkedAudioId === audio.id &&
    audio.linkedVideoId === video.id
  ) {
    return splitLinkedPairAtPlayhead(clips, video, audio, playheadSec)
  }

  return splitSingleClipAtPlayhead(clips, clip, playheadSec)
}

export function deleteClip (clips: TimelineEditorClip[], clipId: string): TimelineEditorClip[] {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return clips
  let next = clips.filter(c => c.id !== clipId)
  if (clip.linkedAudioId) {
    next = next.filter(c => c.id !== clip.linkedAudioId)
  }
  if (clip.linkedVideoId) {
    next = next.map(c =>
      c.id === clip.linkedVideoId ? { ...c, linkedAudioId: undefined, hasAudio: false } : c
    )
  }
  return normalizeTrackLayout(next, clip.track)
}

export function detachAudioFromVideo (
  clips: TimelineEditorClip[],
  videoId: string
): TimelineEditorClip[] {
  const video = clips.find(c => c.id === videoId && c.type === 'video')
  if (!video || !video.hasAudio) return clips

  const audioId = newTimelineClipId()
  const audioClip: TimelineEditorClip = {
    id: audioId,
    type: 'audio',
    track: 'audio',
    src: video.src,
    label: `${video.label} (audio)`,
    sourceStart: video.sourceStart,
    sourceEnd: video.sourceEnd,
    timelineStart: video.timelineStart,
    duration: video.duration,
    linkedVideoId: video.id,
    transitionIn: null,
    transitionOut: null
  }

  return [
    ...clips.map(c =>
      c.id === videoId
        ? { ...c, hasAudio: false, linkedAudioId: audioId }
        : c
    ),
    audioClip
  ]
}

export function setClipTransition (
  clips: TimelineEditorClip[],
  clipId: string,
  which: 'in' | 'out',
  transition: TimelineTransitionType
): TimelineEditorClip[] {
  return clips.map(c => {
    if (c.id !== clipId) return c
    if (which === 'in') return { ...c, transitionIn: transition }
    return { ...c, transitionOut: transition }
  })
}

export function findClipAtTime (
  clips: TimelineEditorClip[],
  track: TimelineEditorTrack,
  time: number
): TimelineEditorClip | null {
  for (const c of clipsOnTrack(clips, track)) {
    if (time >= c.timelineStart && time < clipTimelineEnd(c)) return c
  }
  return null
}

export function createVideoClipFromUrl (opts: {
  src: string
  label: string
  timelineStart?: number
  duration?: number
  sceneId?: string
  shotId?: string
  id?: string
}): TimelineEditorClip {
  const duration = opts.duration ?? DEFAULT_CLIP_DURATION
  return {
    id: opts.id ?? newTimelineClipId(),
    type: 'video',
    track: 'video',
    src: opts.src,
    label: opts.label,
    sourceStart: 0,
    sourceEnd: duration,
    timelineStart: opts.timelineStart ?? 0,
    duration,
    hasAudio: true,
    transitionIn: null,
    transitionOut: null,
    sceneId: opts.sceneId,
    shotId: opts.shotId
  }
}

export function createLinkedVideoAudioClipsFromUrl (opts: {
  src: string
  label: string
  timelineStart?: number
  duration?: number
  sceneId?: string
  shotId?: string
  videoId?: string
  audioId?: string
}): { video: TimelineEditorClip; audio: TimelineEditorClip } {
  const duration = opts.duration ?? DEFAULT_CLIP_DURATION
  const videoId = opts.videoId ?? newTimelineClipId()
  const audioId = opts.audioId ?? newTimelineClipId()
  const timelineStart = opts.timelineStart ?? 0

  return {
    video: {
      id: videoId,
      type: 'video',
      track: 'video',
      src: opts.src,
      label: opts.label,
      sourceStart: 0,
      sourceEnd: duration,
      timelineStart,
      duration,
      hasAudio: false,
      linkedAudioId: audioId,
      transitionIn: null,
      transitionOut: null,
      sceneId: opts.sceneId,
      shotId: opts.shotId
    },
    audio: {
      id: audioId,
      type: 'audio',
      track: 'audio',
      src: opts.src,
      label: `${opts.label} (audio)`,
      sourceStart: 0,
      sourceEnd: duration,
      timelineStart,
      duration,
      linkedVideoId: videoId,
      transitionIn: null,
      transitionOut: null
    }
  }
}
