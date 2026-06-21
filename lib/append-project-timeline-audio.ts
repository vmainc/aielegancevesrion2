import { clipsOnTrack, normalizeTrackLayout } from '~/lib/timeline-editor/clip-ops'
import {
  loadTimelineFromStorage,
  saveTimelineToStorage
} from '~/lib/timeline-editor/storage'
import { DEFAULT_ZOOM_PX_PER_SEC } from '~/types/timeline-editor'
import type { TimelineEditorClip } from '~/types/timeline-editor'
import { useTimelineClipPushedState } from '~/lib/append-project-timeline-video'

export type ProjectTimelineAudioAppend = {
  url: string
  label: string
  id?: string
  /** Timeline clip length in seconds (default 30 for score beds). */
  duration?: number
}

function newClipId (): string {
  return `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function createAudioClip (opts: {
  id: string
  src: string
  label: string
  timelineStart: number
  duration: number
}): TimelineEditorClip {
  return {
    id: opts.id,
    type: 'audio',
    track: 'audio',
    src: opts.src,
    label: opts.label,
    sourceStart: 0,
    sourceEnd: opts.duration,
    timelineStart: opts.timelineStart,
    duration: opts.duration,
    transitionIn: null,
    transitionOut: null
  }
}

/**
 * Append generated (or library) audio to the project timeline audio track.
 */
export function appendAudioToProjectTimeline (
  projectId: string,
  clip: ProjectTimelineAudioAppend
): string {
  if (!import.meta.client) return ''
  const pid = projectId.trim()
  const url = clip.url.trim()
  if (!pid || !url) return ''

  const clipId = clip.id?.trim() || newClipId()
  const duration = typeof clip.duration === 'number' && clip.duration > 0 ? clip.duration : 30
  const doc = loadTimelineFromStorage(pid)
  let clips = doc?.clips ?? []
  const zoom = doc?.zoom ?? DEFAULT_ZOOM_PX_PER_SEC

  if (!clips.some(c => c.id === clipId)) {
    const end = clipsOnTrack(clips, 'audio').reduce(
      (m, c) => Math.max(m, c.timelineStart + c.duration),
      0
    )
    const created = createAudioClip({
      id: clipId,
      src: url,
      label: clip.label,
      timelineStart: end,
      duration
    })
    clips = normalizeTrackLayout([...clips, created], 'audio')
    saveTimelineToStorage(pid, clips, zoom)
  }

  const pushed = useTimelineClipPushedState()
  pushed.value = { projectId: pid, clipId }

  return clipId
}
