import {
  clipsOnTrack,
  createVideoClipFromUrl,
  normalizeTrackLayout
} from '~/lib/timeline-editor/clip-ops'
import {
  loadTimelineFromStorage,
  saveTimelineToStorage
} from '~/lib/timeline-editor/storage'
import { DEFAULT_ZOOM_PX_PER_SEC } from '~/types/timeline-editor'

export type ProjectTimelineVideoAppend = {
  url: string
  label: string
  sceneId?: string
  shotId?: string
  id?: string
  duration?: number
}

/** Bumped when a clip is appended outside the timeline editor (e.g. video generation). */
export type TimelineClipPushedEvent = {
  projectId: string
  clipId: string
}

export function useTimelineClipPushedState () {
  return useState<TimelineClipPushedEvent | null>('aie_timeline_clip_pushed', () => null)
}

function newClipId (): string {
  return `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Append a generated (or library) video to the project timeline (v2 storage only).
 */
export function appendVideoToProjectTimeline (
  projectId: string,
  clip: ProjectTimelineVideoAppend
): string {
  if (!import.meta.client) return ''
  const pid = projectId.trim()
  const url = clip.url.trim()
  if (!pid || !url) return ''

  const clipId = clip.id?.trim() || newClipId()
  const doc = loadTimelineFromStorage(pid)
  let clips = doc?.clips ?? []
  const zoom = doc?.zoom ?? DEFAULT_ZOOM_PX_PER_SEC

  if (!clips.some(c => c.id === clipId)) {
    const end = clipsOnTrack(clips, 'video').reduce(
      (m, c) => Math.max(m, c.timelineStart + c.duration),
      0
    )
    const created = createVideoClipFromUrl({
      id: clipId,
      src: url,
      label: clip.label,
      timelineStart: end,
      duration: clip.duration,
      sceneId: clip.sceneId,
      shotId: clip.shotId
    })
    clips = normalizeTrackLayout([...clips, created], 'video')
    saveTimelineToStorage(pid, clips, zoom)
  }

  const pushed = useTimelineClipPushedState()
  pushed.value = { projectId: pid, clipId }

  return clipId
}
