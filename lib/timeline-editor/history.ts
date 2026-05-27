import type { TimelineEditorClip } from '~/types/timeline-editor'

export interface TimelineHistorySnapshot {
  clips: TimelineEditorClip[]
  zoom: number
  selectedClipId: string | null
}

export const MAX_TIMELINE_HISTORY = 50

export function cloneTimelineSnapshot (s: TimelineHistorySnapshot): TimelineHistorySnapshot {
  return {
    clips: structuredClone(s.clips),
    zoom: s.zoom,
    selectedClipId: s.selectedClipId
  }
}

export function timelineSnapshotsEqual (a: TimelineHistorySnapshot, b: TimelineHistorySnapshot): boolean {
  if (a.zoom !== b.zoom || a.selectedClipId !== b.selectedClipId) return false
  if (a.clips.length !== b.clips.length) return false
  return JSON.stringify(a.clips) === JSON.stringify(b.clips)
}
