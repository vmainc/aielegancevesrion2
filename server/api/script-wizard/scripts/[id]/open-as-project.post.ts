import { createError, getRouterParam, readBody, setResponseStatus } from 'h3'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { createScriptImportJob } from '~/server/utils/script-import-job-registry'
import { runOpenAsProjectImportJob } from '~/server/utils/run-open-as-project-import'
import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'

const ASPECT = new Set<ProjectAspectRatio>(['16:9', '9:16', '1:1'])
const GOALS = new Set<ProjectGoal>(['film', 'social', 'commercial', 'other'])

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing script id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => null) as {
    aspectRatio?: string
    goal?: string
  } | null

  const aspectRatio =
    typeof body?.aspectRatio === 'string' && ASPECT.has(body.aspectRatio as ProjectAspectRatio)
      ? (body.aspectRatio as ProjectAspectRatio)
      : '16:9'
  const goal =
    typeof body?.goal === 'string' && GOALS.has(body.goal as ProjectGoal)
      ? (body.goal as ProjectGoal)
      : 'film'

  const jobId = createScriptImportJob(userId)
  void runOpenAsProjectImportJob({
    jobId,
    userId,
    scriptId: id,
    aspectRatio,
    goal
  })

  setResponseStatus(event, 202)
  return {
    async: true,
    jobId,
    status: 'running'
  }
})
