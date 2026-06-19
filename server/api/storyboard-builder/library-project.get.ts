import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { getOrCreateStoryboardBuilderProjectId } from '~/server/utils/get-or-create-storyboard-builder-project'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()
  const projectId = await getOrCreateStoryboardBuilderProjectId(pb, userId)
  return { projectId }
})
