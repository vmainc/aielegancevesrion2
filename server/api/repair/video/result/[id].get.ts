import { createError, getRouterParam, setHeader } from 'h3'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { readVideoRepairMedia } from '~/server/utils/video-repair-media-store'

export default defineEventHandler(async (event) => {
  await getPocketBaseUserIdFromRequest(event, { allowAccessTokenQuery: true })
  const id = String(getRouterParam(event, 'id') || '').trim()
  const staged = await readVideoRepairMedia(id)
  if (!staged) {
    throw createError({ statusCode: 404, message: 'Media not found or expired.' })
  }
  setHeader(event, 'Content-Type', staged.mime)
  setHeader(event, 'Cache-Control', 'private, max-age=60')
  setHeader(event, 'Accept-Ranges', 'bytes')
  return staged.data
})
