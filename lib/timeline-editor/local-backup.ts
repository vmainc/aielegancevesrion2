import { timelineEditorStorageKey } from '~/lib/timeline-editor/storage'

export const TIMELINE_LOCAL_IMPORTED_PREFIX = 'aie_timeline_editor_v2_imported_'

export function timelineLocalImportedKey (projectId: string): string {
  return `${TIMELINE_LOCAL_IMPORTED_PREFIX}${projectId.trim()}`
}

export interface TimelineLocalImportMarker {
  cloudTimelineId: string
  revision: number
  importedAt: string
}

export function readTimelineLocalImportMarker (
  projectId: string
): TimelineLocalImportMarker | null {
  if (!import.meta.client || !projectId.trim()) return null
  const raw = localStorage.getItem(timelineLocalImportedKey(projectId.trim()))
  if (!raw) return null
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object') return null
    const o = j as Record<string, unknown>
    if (typeof o.cloudTimelineId !== 'string' || typeof o.revision !== 'number') return null
    return {
      cloudTimelineId: o.cloudTimelineId,
      revision: o.revision,
      importedAt: typeof o.importedAt === 'string' ? o.importedAt : ''
    }
  } catch {
    return null
  }
}

export function writeTimelineLocalImportMarker (
  projectId: string,
  marker: TimelineLocalImportMarker
): void {
  if (!import.meta.client || !projectId.trim()) return
  localStorage.setItem(timelineLocalImportedKey(projectId.trim()), JSON.stringify(marker))
}

export const TIMELINE_CONFLICT_BACKUP_PREFIX = 'aie_timeline_editor_v2_conflict_backup_'

export function timelineConflictBackupKey (projectId: string): string {
  return `${TIMELINE_CONFLICT_BACKUP_PREFIX}${projectId.trim()}`
}

/** Preserve current local timeline before loading cloud into the editor. */
export function snapshotTimelineLocalBackup (projectId: string): void {
  if (!import.meta.client || !projectId.trim()) return
  const key = timelineEditorStorageKey(projectId.trim())
  const current = localStorage.getItem(key)
  if (current) {
    localStorage.setItem(timelineConflictBackupKey(projectId.trim()), current)
  }
}

export function defaultLocalBackupKey (projectId: string): string {
  return timelineEditorStorageKey(projectId)
}
