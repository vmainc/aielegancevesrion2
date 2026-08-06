import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { formatPocketBaseRecordError, isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'
import {
  PROJECT_BIBLE_SCOPES,
  syncProjectToBible,
  type ProjectBibleScope
} from '~/server/utils/sync-project-to-bible'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId: _authUserId, pb, access } = await requireProjectOwner(event, projectId || '')

  const body = await readBody<{ scopes?: ProjectBibleScope[] | 'all' }>(event).catch(() => ({}))
  let scopes: ProjectBibleScope[] | 'all' = 'all'
  if (Array.isArray(body?.scopes)) {
    const allowed = new Set(PROJECT_BIBLE_SCOPES)
    scopes = body.scopes.filter((s): s is ProjectBibleScope => allowed.has(s as ProjectBibleScope))
    if (!scopes.length) scopes = 'all'
  }

  try {
    const result = await syncProjectToBible({
      pb,
      userId: access.ownerId,
      projectId: projectId || '',
      scopes
    })
    return { sync: result }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'Production Bible collections are missing. Run: node scripts/setup-collections.js'
      })
    }
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not sync Production Bible'
    })
  }
})
