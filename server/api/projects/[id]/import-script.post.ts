import { readMultipartFormData, createError, getHeader, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { uploadScriptFileToProject } from '~/server/utils/import-script-core'

/**
 * Save a screenplay file to project assets only. Run POST .../script/analyze for AI treatment / scenes / characters.
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)

  const parts = await readMultipartFormData(event)
  if (parts == null || !parts.length) {
    const ct = getHeader(event, 'content-type') || ''
    throw createError({
      statusCode: 400,
      message: ct.includes('multipart')
        ? 'Could not read upload body. Try a smaller file or ensure the file field is named "file".'
        : `Expected multipart/form-data upload (got: ${ct || 'no Content-Type'})`
    })
  }

  let fileBuf: Buffer | null = null
  let filename = 'script'

  for (const part of parts) {
    if (!part.name) continue
    if (part.name === 'file' && part.data?.length) {
      fileBuf = part.data
      filename = (part.filename && part.filename.trim()) || 'script.upload'
    }
  }

  if (!fileBuf?.length) {
    throw createError({ statusCode: 400, message: 'Missing script file' })
  }

  const pb = await getAuthenticatedPocketBase()

  return uploadScriptFileToProject({
    userId,
    pb,
    projectId,
    fileBuf,
    filename
  })
})
