import { readMultipartFormData, createError, getHeader, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { importScriptIntoPocketBase } from '~/server/utils/import-script-core'

const ASPECT = new Set(['16:9', '9:16', '1:1'])
const GOALS = new Set(['film', 'social', 'commercial', 'other'])

/**
 * Import a script into an **existing** project (clears previous scenes & characters for that project).
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
  let aspectRatio = '16:9'
  let goal = 'film'

  for (const part of parts) {
    if (!part.name) continue
    if (part.name === 'file' && part.data?.length) {
      fileBuf = part.data
      filename = (part.filename && part.filename.trim()) || 'script.upload'
    }
    if (part.name === 'aspectRatio' && part.data) {
      const v = part.data.toString('utf8').trim()
      if (ASPECT.has(v)) aspectRatio = v
    }
    if (part.name === 'goal' && part.data) {
      const v = part.data.toString('utf8').trim()
      if (GOALS.has(v)) goal = v
    }
  }

  if (!fileBuf?.length) {
    throw createError({ statusCode: 400, message: 'Missing script file' })
  }

  const pb = await getAuthenticatedPocketBase()

  return importScriptIntoPocketBase({
    userId,
    pb,
    fileBuf,
    filename,
    aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
    goal: goal as 'film' | 'social' | 'commercial' | 'other',
    existingProjectId: projectId
  })
})
