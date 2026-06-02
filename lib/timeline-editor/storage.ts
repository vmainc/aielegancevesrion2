import { parseEditorDocument } from '~/lib/timeline-editor/migrate'
import {
  type TimelineEditorClip,
  type TimelineEditorDocument
} from '~/types/timeline-editor'

export const TIMELINE_EDITOR_KEY_PREFIX = 'aie_timeline_editor_v2_'

export function timelineEditorStorageKey (projectId: string): string {
  return `${TIMELINE_EDITOR_KEY_PREFIX}${projectId}`
}

export function saveTimelineToStorage (
  projectId: string,
  clips: TimelineEditorClip[],
  zoom: number
): void {
  if (!import.meta.client || !projectId.trim()) return
  const payload: TimelineEditorDocument = {
    version: 2,
    clips,
    zoom
  }
  localStorage.setItem(timelineEditorStorageKey(projectId.trim()), JSON.stringify(payload))
}

/** Load v2 timeline only (no legacy v1 fallback). */
export function loadTimelineFromStorage (projectId: string): TimelineEditorDocument | null {
  if (!import.meta.client || !projectId.trim()) return null
  const pid = projectId.trim()
  return parseEditorDocument(localStorage.getItem(timelineEditorStorageKey(pid)))
}
