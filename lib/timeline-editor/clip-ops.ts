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

export function splitClipAtPlayhead (
  clips: TimelineEditorClip[],
  clipId: string,
  playheadSec: number
): TimelineEditorClip[] {
  const clip = clips.find(c => c.id === clipId)
  if (!clip) return clips
  const local = playheadSec - clip.timelineStart
  if (local <= MIN_CLIP_DURATION || local >= clip.duration - MIN_CLIP_DURATION) return clips

  const splitSource = clip.sourceStart + local
  const first: TimelineEditorClip = {
    ...clip,
    sourceEnd: splitSource,
    duration: local
  }
  const second: TimelineEditorClip = {
    ...clip,
    id: newTimelineClipId(),
    sourceStart: splitSource,
    timelineStart: clip.timelineStart + local,
    duration: clip.duration - local
  }
  const rest = clips.filter(c => c.id !== clipId)
  return normalizeTrackLayout([...rest, first, second], clip.track)
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
