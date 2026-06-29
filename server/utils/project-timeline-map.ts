import {
  normalizeProjectTimelineDocument,
  timelineDocumentStats
} from '~/lib/project-timeline-normalize'
import { bibleRelId } from '~/server/utils/bible-project-access'
import type {
  ProjectTimeline,
  ProjectTimelineDocument,
  ProjectTimelineSource
} from '~/types/project-timeline'
import { PROJECT_TIMELINE_SCHEMA_VERSION } from '~/types/project-timeline'
import { timelineEditorStorageKey } from '~/lib/timeline-editor/storage'

type PbProjectTimelineRecord = {
  id: string
  owned_by?: string | { id?: string }
  owner?: string | { id?: string }
  user?: string | { id?: string }
  project?: string | { id?: string }
  title?: string
  timeline_json?: unknown
  schema_version?: number
  revision?: number
  source?: string
  imported_from_local?: boolean
  local_backup_key?: string
  created?: string
  updated?: string
}

export function projectIdOnTimelineRow (raw: Record<string, unknown>): string {
  return bibleRelId(raw.project as string | { id?: string } | undefined)
}

function parseSource (value: unknown): ProjectTimelineSource {
  if (value === 'local_import' || value === 'migration') return value
  return 'editor'
}

export function pbRecordToProjectTimeline (r: PbProjectTimelineRecord): ProjectTimeline | null {
  const document = normalizeProjectTimelineDocument(r.timeline_json)
  if (!document) return null
  const stats = timelineDocumentStats(document)
  return {
    id: r.id,
    ownerId: bibleRelId(r.owned_by || r.owner || r.user),
    projectId: bibleRelId(r.project),
    title: String(r.title || 'Main timeline'),
    schemaVersion: Number(r.schema_version) || PROJECT_TIMELINE_SCHEMA_VERSION,
    revision: Number(r.revision) || 1,
    document,
    source: parseSource(r.source),
    importedFromLocal: Boolean(r.imported_from_local),
    localBackupKey: String(r.local_backup_key || ''),
    clipCount: stats.clipCount,
    durationSeconds: stats.durationSeconds,
    created: String(r.created || ''),
    updated: String(r.updated || '')
  }
}

export function projectTimelineDocumentToPbFields (opts: {
  ownerId: string
  projectId: string
  document: ProjectTimelineDocument
  title?: string
  revision: number
  source?: ProjectTimelineSource
  importedFromLocal?: boolean
  localBackupKey?: string
}): Record<string, unknown> {
  return {
    owned_by: opts.ownerId,
    project: opts.projectId,
    title: (opts.title || 'Main timeline').slice(0, 200),
    timeline_json: opts.document,
    schema_version: PROJECT_TIMELINE_SCHEMA_VERSION,
    revision: opts.revision,
    source: opts.source || 'editor',
    imported_from_local: Boolean(opts.importedFromLocal),
    local_backup_key: (opts.localBackupKey || timelineEditorStorageKey(opts.projectId)).slice(0, 300)
  }
}
