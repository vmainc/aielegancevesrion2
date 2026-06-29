import type { ProjectTimelineDocument } from '~/types/project-timeline'
import type { TimelineEditorDocument } from '~/types/timeline-editor'
import { editorDocumentToProjectTimelineDocument } from '~/lib/project-timeline-normalize'

export const TIMELINE_CLOUD_SAVE_QUEUE_PREFIX = 'aie_timeline_cloud_save_queue_'

export type TimelineCloudSaveQueueStatus = 'pending' | 'flushing' | 'failed'

export interface TimelineCloudSaveQueueEntry {
  projectId: string
  document: ProjectTimelineDocument
  baseRevision: number | null
  queuedAt: string
  lastAttemptAt: string | null
  attemptCount: number
  lastError: string | null
  status: TimelineCloudSaveQueueStatus
  importedFromLocal?: boolean
}

export function timelineCloudSaveQueueKey (projectId: string): string {
  return `${TIMELINE_CLOUD_SAVE_QUEUE_PREFIX}${projectId.trim()}`
}

function parseQueueEntry (raw: string, projectId: string): TimelineCloudSaveQueueEntry | null {
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object') return null
    const o = j as Record<string, unknown>
    if (o.projectId !== projectId.trim()) return null
    if (!o.document || typeof o.document !== 'object') return null
    const doc = o.document as ProjectTimelineDocument
    if (doc.version !== 2 || !Array.isArray(doc.clips)) return null
    const status = o.status
    if (status !== 'pending' && status !== 'flushing' && status !== 'failed') return null
    return {
      projectId: projectId.trim(),
      document: doc,
      baseRevision: typeof o.baseRevision === 'number' ? o.baseRevision : null,
      queuedAt: typeof o.queuedAt === 'string' ? o.queuedAt : new Date().toISOString(),
      lastAttemptAt: typeof o.lastAttemptAt === 'string' ? o.lastAttemptAt : null,
      attemptCount: typeof o.attemptCount === 'number' ? o.attemptCount : 0,
      lastError: typeof o.lastError === 'string' ? o.lastError : null,
      status,
      importedFromLocal: Boolean(o.importedFromLocal)
    }
  } catch {
    return null
  }
}

export function readTimelineCloudSaveQueue (
  projectId: string
): TimelineCloudSaveQueueEntry | null {
  if (!import.meta.client || !projectId.trim()) return null
  const raw = localStorage.getItem(timelineCloudSaveQueueKey(projectId))
  if (!raw) return null
  return parseQueueEntry(raw, projectId)
}

export function writeTimelineCloudSaveQueue (
  projectId: string,
  entry: TimelineCloudSaveQueueEntry
): void {
  if (!import.meta.client || !projectId.trim()) return
  localStorage.setItem(timelineCloudSaveQueueKey(projectId.trim()), JSON.stringify(entry))
}

export function clearTimelineCloudSaveQueue (projectId: string): void {
  if (!import.meta.client || !projectId.trim()) return
  localStorage.removeItem(timelineCloudSaveQueueKey(projectId.trim()))
}

export function enqueueTimelineCloudSave (
  projectId: string,
  doc: TimelineEditorDocument,
  opts?: {
    baseRevision?: number | null
    lastError?: string | null
    importedFromLocal?: boolean
  }
): TimelineCloudSaveQueueEntry {
  const existing = readTimelineCloudSaveQueue(projectId)
  const entry: TimelineCloudSaveQueueEntry = {
    projectId: projectId.trim(),
    document: editorDocumentToProjectTimelineDocument(doc),
    baseRevision: opts?.baseRevision ?? existing?.baseRevision ?? null,
    queuedAt: existing?.queuedAt ?? new Date().toISOString(),
    lastAttemptAt: existing?.lastAttemptAt ?? null,
    attemptCount: existing?.attemptCount ?? 0,
    lastError: opts?.lastError ?? existing?.lastError ?? null,
    status: 'pending',
    importedFromLocal: Boolean(opts?.importedFromLocal ?? existing?.importedFromLocal)
  }
  writeTimelineCloudSaveQueue(projectId, entry)
  return entry
}

export function markTimelineCloudSaveQueueAttempt (
  projectId: string,
  patch: {
    lastError?: string | null
    status?: TimelineCloudSaveQueueStatus
  }
): TimelineCloudSaveQueueEntry | null {
  const entry = readTimelineCloudSaveQueue(projectId)
  if (!entry) return null
  const next: TimelineCloudSaveQueueEntry = {
    ...entry,
    lastAttemptAt: new Date().toISOString(),
    attemptCount: entry.attemptCount + 1,
    lastError: patch.lastError !== undefined ? patch.lastError : entry.lastError,
    status: patch.status ?? entry.status
  }
  writeTimelineCloudSaveQueue(projectId, next)
  return next
}

export function countTimelineCloudSaveQueue (projectId: string): number {
  return readTimelineCloudSaveQueue(projectId) ? 1 : 0
}
