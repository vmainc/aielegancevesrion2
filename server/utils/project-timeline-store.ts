import type PocketBase from 'pocketbase'
import {
  pbRecordToProjectTimeline,
  projectTimelineDocumentToPbFields
} from '~/server/utils/project-timeline-map'
import { editorDocumentToProjectTimelineDocument } from '~/lib/project-timeline-normalize'
import { timelineEditorStorageKey } from '~/lib/timeline-editor/storage'
import { DEFAULT_ZOOM_PX_PER_SEC } from '~/types/timeline-editor'
import type { ProjectTimeline, ProjectTimelineDocument } from '~/types/project-timeline'
import { projectTimelineDocumentToEditorDocument } from '~/lib/project-timeline-normalize'

export async function loadProjectTimelineRow (
  pb: PocketBase,
  userId: string,
  projectId: string
): Promise<{ row: Record<string, unknown> | null; timeline: ProjectTimeline | null }> {
  const rows = await pb.collection('project_timelines').getList(1, 1, {
    filter: `project = "${projectId}" && owned_by = "${userId}"`,
    sort: '-updated'
  })
  const row = (rows.items[0] as Record<string, unknown> | undefined) ?? null
  if (!row) return { row: null, timeline: null }
  const timeline = pbRecordToProjectTimeline(row as Parameters<typeof pbRecordToProjectTimeline>[0])
  return { row, timeline }
}

export function emptyTimelineDocument (): ProjectTimelineDocument {
  return {
    version: 2,
    clips: [],
    zoom: DEFAULT_ZOOM_PX_PER_SEC,
    updatedAt: new Date().toISOString()
  }
}

export async function saveProjectTimelineDocument (
  pb: PocketBase,
  opts: {
    userId: string
    projectId: string
    document: ProjectTimelineDocument
    existing: ProjectTimeline | null
    title?: string
    source?: 'editor' | 'local_import' | 'migration'
    importedFromLocal?: boolean
  }
): Promise<ProjectTimeline> {
  const document = editorDocumentToProjectTimelineDocument(
    projectTimelineDocumentToEditorDocument(opts.document),
    opts.document.updatedAt || new Date().toISOString()
  )
  const localBackupKey = timelineEditorStorageKey(opts.projectId)

  if (!opts.existing) {
    const fields = projectTimelineDocumentToPbFields({
      ownerId: opts.userId,
      projectId: opts.projectId,
      document,
      title: opts.title || 'Main timeline',
      revision: 1,
      source: opts.source || 'editor',
      importedFromLocal: Boolean(opts.importedFromLocal),
      localBackupKey
    })
    const created = await pb.collection('project_timelines').create(fields)
    const timeline = pbRecordToProjectTimeline(created as Parameters<typeof pbRecordToProjectTimeline>[0])
    if (!timeline) throw new Error('Failed to create timeline')
    return timeline
  }

  const nextRevision = opts.existing.revision + 1
  const fields = projectTimelineDocumentToPbFields({
    ownerId: opts.userId,
    projectId: opts.projectId,
    document,
    title: opts.title || opts.existing.title,
    revision: nextRevision,
    source: opts.source || opts.existing.source,
    importedFromLocal: opts.importedFromLocal ?? opts.existing.importedFromLocal,
    localBackupKey: opts.existing.localBackupKey || localBackupKey
  })
  const updated = await pb.collection('project_timelines').update(opts.existing.id, fields)
  const timeline = pbRecordToProjectTimeline(updated as Parameters<typeof pbRecordToProjectTimeline>[0])
  if (!timeline) throw new Error('Failed to update timeline')
  return timeline
}
