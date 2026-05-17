import { getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { bootstrapProjectFromConcept } from '~/server/utils/bootstrap-project-from-concept'
import { ApiErrorCode, isAbortLikeError, throwApiError } from '~/server/utils/api-error-envelope'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Missing project id')
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const body = await readBody(event).catch(() => null) as {
    title?: string
    logline?: string
    summary?: string
    genre?: string
    tone?: string
    characters?: unknown
  } | null

  const characters = Array.isArray(body?.characters)
    ? body!.characters.filter((c): c is string => typeof c === 'string')
    : undefined

  try {
    const result = await bootstrapProjectFromConcept({
      userId,
      pb,
      projectId,
      title: typeof body?.title === 'string' ? body.title : undefined,
      logline: typeof body?.logline === 'string' ? body.logline : undefined,
      summary: typeof body?.summary === 'string' ? body.summary : undefined,
      genre: typeof body?.genre === 'string' ? body.genre : undefined,
      tone: typeof body?.tone === 'string' ? body.tone : undefined,
      characters
    })

    return {
      project: result.project,
      storyboard: result.storyboard,
      sceneCount: result.sceneCount,
      importComplete: true
    }
  } catch (e: unknown) {
    if (isAbortLikeError(e)) {
      throwApiError(
        504,
        ApiErrorCode.OPENROUTER_TIMEOUT,
        'Building the project timed out. Try again — large stories can take several minutes.',
        { projectId }
      )
    }
    throw e
  }
})
