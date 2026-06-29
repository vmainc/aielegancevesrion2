import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { remediateLegacySeededFacts } from '~/server/utils/remediate-legacy-seeded-facts'
import { formatPocketBaseRecordError, isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId, pb } = await requireProjectOwner(event, projectId || '')

  const body = await readBody<{ dryRun?: boolean }>(event).catch(() => ({}))
  const dryRun = body?.dryRun !== false

  try {
    const remediation = await remediateLegacySeededFacts({
      pb,
      userId,
      projectId: projectId || '',
      dryRun
    })
    return { remediation }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'bible_facts collection is missing. Run: node scripts/setup-collections.js'
      })
    }
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not remediate legacy seeded facts'
    })
  }
})
