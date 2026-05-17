import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { getOrCreateScriptLibraryProjectId } from '~/server/utils/get-or-create-script-library-project'

/** PocketBase project id used for Script Wizard concept generation (same as overview’s generate-concepts). */
export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()
  const projectId = await getOrCreateScriptLibraryProjectId(pb, userId)
  return { projectId }
})
