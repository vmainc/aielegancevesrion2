import { migrateLegacyTimeline, parseEditorDocument } from '~/lib/timeline-editor/migrate'
import {
  DEFAULT_ZOOM_PX_PER_SEC,
  type TimelineEditorClip,
  type TimelineEditorDocument
} from '~/types/timeline-editor'

export const TIMELINE_EDITOR_KEY_PREFIX = 'aie_timeline_editor_v2_'

/** @deprecated One-time migration source only — never written after migrate. */
const LEGACY_V1_KEY_PREFIX = 'aie_timeline_v1_'

interface LegacyTimelinePayload {
  video?: Array<{
    id: string
    label: string
    url: string
    scene_id?: string
    shot_id?: string
    sceneId?: string
    shotId?: string
  }>
  audio?: Array<{ id: string; label: string; url: string }>
}

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

/** Load v2 timeline; migrate and delete v1 once if v2 is empty. */
export function loadTimelineFromStorage (projectId: string): TimelineEditorDocument | null {
  if (!import.meta.client || !projectId.trim()) return null
  const pid = projectId.trim()
  const parsed = parseEditorDocument(localStorage.getItem(timelineEditorStorageKey(pid)))
  if (parsed?.clips.length) return parsed
  return migrateV1TimelineOnce(pid)
}

function migrateV1TimelineOnce (projectId: string): TimelineEditorDocument | null {
  const legacyKey = `${LEGACY_V1_KEY_PREFIX}${projectId}`
  const legacyRaw = localStorage.getItem(legacyKey)
  if (!legacyRaw) return null
  try {
    const j = JSON.parse(legacyRaw) as LegacyTimelinePayload
    const clips = migrateLegacyTimeline({
      video: (Array.isArray(j.video) ? j.video : []).map(v => ({
        id: v.id,
        label: v.label,
        url: v.url,
        sceneId: v.sceneId ?? v.scene_id,
        shotId: v.shotId ?? v.shot_id
      })),
      audio: Array.isArray(j.audio) ? j.audio : []
    })
    localStorage.removeItem(legacyKey)
    if (!clips.length) return null
    const doc: TimelineEditorDocument = {
      version: 2,
      clips,
      zoom: DEFAULT_ZOOM_PX_PER_SEC
    }
    saveTimelineToStorage(projectId, clips, doc.zoom)
    return doc
  } catch {
    localStorage.removeItem(legacyKey)
    return null
  }
}
