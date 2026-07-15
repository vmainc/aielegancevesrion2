import { createError, getRouterParam } from 'h3'
import { requireProjectOwnerOnly } from '~/server/utils/bible-project-access'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const memberUserId = getRouterParam(event, 'userId')
  if (!projectId || !memberUserId) {
    throw createError({ statusCode: 400, message: 'Missing project or user id' })
  }

  const { pb } = await requireProjectOwnerOnly(event, projectId)

  try {
    const rows = await pb.collection('project_members').getFullList({
      filter: `project = "${projectId}" && user = "${memberUserId}"`,
      batch: 5
    })
    const row = rows[0] as { id?: string } | undefined
    if (!row?.id) {
      throw createError({ statusCode: 404, message: 'Member not found' })
    }
    await pb.collection('project_members').delete(row.id)
    return { ok: true }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'project_members collection is missing. Run: node scripts/setup-collections.js'
      })
    }
    if (pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: 'Member not found' })
    }
    throw e
  }
})
