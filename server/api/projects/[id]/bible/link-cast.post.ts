import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { linkCastToBible } from '~/server/utils/link-cast-to-bible'
import { formatPocketBaseRecordError, isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { pb, access } = await requireProjectOwner(event, projectId || '')

  const body = await readBody<{ dryRun?: boolean }>(event).catch(() => ({}))
  const dryRun = body?.dryRun !== false

  try {
    const link = await linkCastToBible({
      pb,
      userId: access.ownerId,
      projectId: projectId || '',
      dryRun
    })
    return { link }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'bible_entities or creative_characters collection is missing. Run: node scripts/setup-collections.js'
      })
    }
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not link cast to Production Bible'
    })
  }
})
