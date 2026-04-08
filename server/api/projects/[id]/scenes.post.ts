import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(project as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const body = await readBody<{
    heading?: string
    title?: string
    summary?: string
    description?: string
    body?: string
  }>(event)

  const headingRaw = typeof body?.heading === 'string' ? body.heading : typeof body?.title === 'string' ? body.title : ''
  const heading = headingRaw.trim().slice(0, 2000)
  if (!heading) {
    throw createError({ statusCode: 400, message: 'Title is required' })
  }

  const desc =
    typeof body?.description === 'string'
      ? body.description.trim()
      : typeof body?.summary === 'string'
        ? body.summary.trim()
        : ''
  const summary = desc.slice(0, 5000)
  const extraBody = typeof body?.body === 'string' ? body.body.trim() : ''
  const bodyText = (extraBody || desc).slice(0, 150000)

  const top = await pb.collection('creative_scenes').getFullList({
    filter: `project="${projectId}"`,
    sort: '-sort_order',
    batch: 1
  })
  /** 1-based sequence; PocketBase rejects blank/ambiguous sort_order — never use 0 for first row. */
  let nextOrder = 1
  if (top.length) {
    const prev = Number(top[0].sort_order)
    const base = Number.isFinite(prev) ? Math.max(0, Math.floor(prev)) : 0
    nextOrder = base + 1
  }

  try {
    const created = await pb.collection('creative_scenes').create({
      owned_by: userId,
      project: projectId,
      sort_order: nextOrder,
      heading,
      summary,
      body: bodyText
    })
    return {
      scene: {
        id: created.id,
        sortOrder: nextOrder,
        heading,
        summary,
        bodyLength: bodyText.length
      }
    }
  } catch (e: unknown) {
    const detail = formatPocketBaseRecordError(e)
    throw createError({
      statusCode: 400,
      message: detail && detail !== 'Failed to create record.' ? detail : 'Could not create scene. Check PocketBase creative_scenes rules and field limits.'
    })
  }
})
