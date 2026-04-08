import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { seedStoryboardFromProjectScenes } from '~/server/utils/import-script-core'

/**
 * Import-style storyboard seed: shot lists for the first N scenes (same helper as monolithic import).
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const result = await seedStoryboardFromProjectScenes({
    userId,
    pb,
    projectId
  })

  return { result }
})
