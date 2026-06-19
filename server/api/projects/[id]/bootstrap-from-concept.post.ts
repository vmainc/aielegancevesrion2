import { getRouterParam, readBody, setResponseStatus } from 'h3'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { createScriptImportJob } from '~/server/utils/script-import-job-registry'
import { runConceptBootstrapJob } from '~/server/utils/run-concept-bootstrap-job'
import { parseDirectorField } from '~/server/utils/creative-project-map'
import { clampTargetDurationSeconds } from '~/lib/project-duration-budget'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'

/**
 * Async: screenplay + director + cast + scenes + storyboard shot lists (can take several minutes).
 * Poll GET /api/script-import/jobs/:jobId
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Missing project id')
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => null) as {
    title?: string
    logline?: string
    summary?: string
    genre?: string
    tone?: string
    characters?: unknown
    director?: unknown
    visual_reference?: string
    visualReference?: string
    target_duration_seconds?: number
  } | null

  const characters = Array.isArray(body?.characters)
    ? body!.characters.filter((c): c is string => typeof c === 'string')
    : undefined

  const jobId = createScriptImportJob(userId)
  const visualReference =
    typeof body?.visual_reference === 'string'
      ? body.visual_reference.trim()
      : typeof body?.visualReference === 'string'
        ? body.visualReference.trim()
        : undefined
  const director = parseDirectorField(body?.director) ?? undefined

  void runConceptBootstrapJob({
    jobId,
    userId,
    projectId,
    title: typeof body?.title === 'string' ? body.title : undefined,
    logline: typeof body?.logline === 'string' ? body.logline : undefined,
    summary: typeof body?.summary === 'string' ? body.summary : undefined,
    genre: typeof body?.genre === 'string' ? body.genre : undefined,
    tone: typeof body?.tone === 'string' ? body.tone : undefined,
    characters,
    director,
    visualReference: visualReference || undefined,
    targetDurationSeconds: clampTargetDurationSeconds(body?.target_duration_seconds)
  })

  setResponseStatus(event, 202)
  return {
    async: true,
    jobId,
    status: 'running'
  }
})
