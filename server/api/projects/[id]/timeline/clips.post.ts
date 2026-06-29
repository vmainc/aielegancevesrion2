import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import type { TimelineClipsAppendBody } from '~/types/project-timeline'
import { appendClipsToProjectTimeline } from '~/server/utils/append-project-timeline-clips'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId, pb } = await requireProjectOwner(event, projectId || '')

  const body = await readBody<TimelineClipsAppendBody>(event)

  try {
    return await appendClipsToProjectTimeline(pb, userId, projectId || '', body || { clips: [] })
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'project_timelines collection is missing. Run npm run setup-db.'
      })
    }
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    throw e
  }
})
