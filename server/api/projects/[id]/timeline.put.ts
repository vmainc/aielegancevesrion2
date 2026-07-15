import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  pbRecordToProjectTimeline,
  projectIdOnTimelineRow,
  projectTimelineDocumentToPbFields
} from '~/server/utils/project-timeline-map'
import {
  editorDocumentToProjectTimelineDocument,
  normalizeProjectTimelineDocument
} from '~/lib/project-timeline-normalize'
import { timelineEditorStorageKey } from '~/lib/timeline-editor/storage'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import type { ProjectTimelinePutBody, ProjectTimelineSource } from '~/types/project-timeline'
import { PROJECT_TIMELINE_LIST_SORT } from '~/server/utils/project-timeline-store'

function parseSource (value: unknown): ProjectTimelineSource | undefined {
  if (value === 'editor' || value === 'local_import' || value === 'migration') return value
  return undefined
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId, pb } = await requireProjectOwner(event, projectId || '')

  const body = await readBody<ProjectTimelinePutBody>(event)
  const normalized = normalizeProjectTimelineDocument(body?.document)
  if (!normalized) {
    throw createError({ statusCode: 400, message: 'Invalid timeline document' })
  }

  const document = editorDocumentToProjectTimelineDocument(
    { version: 2, clips: normalized.clips, zoom: normalized.zoom },
    normalized.updatedAt || new Date().toISOString()
  )

  const baseRevision =
    typeof body?.baseRevision === 'number' && Number.isFinite(body.baseRevision)
      ? body.baseRevision
      : undefined
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const importedFromLocal = Boolean(body?.importedFromLocal)
  const source = parseSource(body?.source)
  const localBackupKey = timelineEditorStorageKey(projectId || '')

  try {
    const existing = await pb.collection('project_timelines').getList(1, 1, {
      filter: `project = "${projectId}" && owned_by = "${userId}"`,
      sort: PROJECT_TIMELINE_LIST_SORT
    })

    const row = existing.items[0] as Record<string, unknown> | undefined

    if (!row) {
      const fields = projectTimelineDocumentToPbFields({
        ownerId: userId,
        projectId: projectId || '',
        document,
        title: title || 'Main timeline',
        revision: 1,
        source: source || (importedFromLocal ? 'local_import' : 'editor'),
        importedFromLocal,
        localBackupKey
      })
      const created = await pb.collection('project_timelines').create(fields)
      const timeline = pbRecordToProjectTimeline(created as Parameters<typeof pbRecordToProjectTimeline>[0])
      if (!timeline) {
        throw createError({ statusCode: 500, message: 'Failed to create timeline' })
      }
      return { timeline }
    }

    const current = pbRecordToProjectTimeline(row as Parameters<typeof pbRecordToProjectTimeline>[0])
    if (!current) {
      throw createError({ statusCode: 500, message: 'Stored timeline document is invalid' })
    }

    if (projectIdOnTimelineRow(row) !== projectId) {
      throw createError({ statusCode: 400, message: 'Timeline does not belong to this project' })
    }

    if (baseRevision == null || baseRevision !== current.revision) {
      throw createError({
        statusCode: 409,
        message: 'Timeline was updated elsewhere. Reload and try again.',
        data: { currentRevision: current.revision, timeline: current }
      })
    }

    const nextRevision = current.revision + 1
    const fields = projectTimelineDocumentToPbFields({
      ownerId: userId,
      projectId: projectId || '',
      document,
      title: title || current.title,
      revision: nextRevision,
      source: source || current.source,
      importedFromLocal: importedFromLocal || current.importedFromLocal,
      localBackupKey: current.localBackupKey || localBackupKey
    })

    const updated = await pb.collection('project_timelines').update(current.id, fields)
    const timeline = pbRecordToProjectTimeline(updated as Parameters<typeof pbRecordToProjectTimeline>[0])
    if (!timeline) {
      throw createError({ statusCode: 500, message: 'Failed to update timeline' })
    }
    return { timeline }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'project_timelines collection is missing. Run npm run setup-db.'
      })
    }
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    if (pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: 'Timeline not found' })
    }
    throw e
  }
})
