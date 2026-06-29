import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  pbRecordToProjectTimeline,
  projectIdOnTimelineRow
} from '~/server/utils/project-timeline-map'
import { timelineEditorStorageKey } from '~/lib/timeline-editor/storage'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId, pb } = await requireProjectOwner(event, projectId || '')

  const localStorageKey = timelineEditorStorageKey(projectId || '')

  try {
    const rows = await pb.collection('project_timelines').getList(1, 1, {
      filter: `project = "${projectId}" && owned_by = "${userId}"`,
      sort: '-updated'
    })

    const row = rows.items[0] as Record<string, unknown> | undefined
    if (!row) {
      return { timeline: null, localStorageKey }
    }

    const projectOnRow = projectIdOnTimelineRow(row)
    if (projectOnRow !== projectId) {
      throw createError({ statusCode: 400, message: 'Timeline does not belong to this project' })
    }

    const timeline = pbRecordToProjectTimeline(row as Parameters<typeof pbRecordToProjectTimeline>[0])
    if (!timeline) {
      throw createError({ statusCode: 500, message: 'Stored timeline document is invalid' })
    }

    return { timeline, localStorageKey }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'project_timelines collection is missing. Run npm run setup-db.'
      })
    }
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    if (pocketBaseErrorStatus(e) === 404) {
      return { timeline: null, localStorageKey }
    }
    throw e
  }
})
