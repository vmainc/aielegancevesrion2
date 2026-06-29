import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { redactLegacyAssetPrompts } from '~/server/utils/redact-legacy-asset-prompts'
import { formatPocketBaseRecordError, isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId, pb } = await requireProjectOwner(event, projectId || '')

  const body = await readBody<{ dryRun?: boolean }>(event).catch(() => ({}))
  const dryRun = body?.dryRun !== false

  try {
    const redaction = await redactLegacyAssetPrompts({
      pb,
      userId,
      projectId: projectId || '',
      dryRun
    })
    return { redaction }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'project_assets collection is missing. Run: node scripts/setup-collections.js'
      })
    }
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not redact legacy prompt metadata'
    })
  }
})
