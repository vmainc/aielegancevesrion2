import { readMultipartFormData, createError, getHeader, getRouterParam, type H3Event } from 'h3'
import PocketBase from 'pocketbase'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { uploadScriptFileToProject } from '~/server/utils/import-script-core'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError
} from '~/server/utils/pb-missing-collection-error'
import { resolvePocketBaseAdmin } from '~/server/utils/server-env'

function bearerTokenFromEvent (event: H3Event): string {
  const raw = getHeader(event, 'authorization') || getHeader(event, 'Authorization') || ''
  const m = raw.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || ''
}

/**
 * Save a screenplay file to project assets only. Run POST .../script/analyze for AI treatment / scenes / characters.
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const token = bearerTokenFromEvent(event)

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

  try {
    let pb: PocketBase
    try {
      pb = await getAuthenticatedPocketBase()
    } catch (adminErr: unknown) {
      const config = useRuntimeConfig()
      const admin = resolvePocketBaseAdmin(config)
      const base =
        admin.internalUrl ||
        String(config.pocketbaseInternalUrl || '').replace(/\/+$/, '') ||
        String(config.public.pocketbaseUrl || '').replace(/\/+$/, '')
      if (!base || !token) throw adminErr
      // Fallback for production env drift: use the caller's validated users token.
      pb = new PocketBase(base)
      pb.authStore.save(token, { id: userId } as never)
    }
    return await uploadScriptFileToProject({
      userId,
      pb,
      projectId,
      fileBuf,
      filename
    })
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message:
          'PocketBase schema is incomplete for script save. Run setup-db against production PocketBase and retry.'
      })
    }
    const msg = formatPocketBaseRecordError(e)
    const status =
      e && typeof e === 'object' && 'statusCode' in e
        ? Number((e as { statusCode?: number }).statusCode || 500)
        : e && typeof e === 'object' && 'status' in e
          ? Number((e as { status?: number }).status || 500)
          : 500
    throw createError({
      statusCode: status >= 400 && status < 600 ? status : 500,
      message: msg || 'Could not save screenplay to project assets.'
    })
  }
})
