import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { seedProductionBibleFromProject } from '~/server/utils/seed-production-bible'
import { formatPocketBaseRecordError, isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId, pb, access } = await requireProjectOwner(event, projectId || '')

  const body = await readBody<{ dryRun?: boolean }>(event).catch(() => ({}))
  const dryRun = body?.dryRun === true

  try {
    const result = await seedProductionBibleFromProject({
      pb,
      userId: access.ownerId,
      projectId: projectId || '',
      dryRun
    })
    return { seed: result }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'Production Bible collections are missing. Run: node scripts/setup-collections.js'
      })
    }
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not seed Production Bible'
    })
  }
})
