import { getRouterParam, createError, setHeader } from 'h3'
import { readVideoStartFrame } from '~/server/utils/video-start-frame-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing frame id' })
  }

  const frame = await readVideoStartFrame(id)
  if (!frame) {
    throw createError({ statusCode: 404, message: 'Starting frame not found or expired' })
  }

  setHeader(event, 'Content-Type', frame.mime)
  setHeader(event, 'Cache-Control', 'private, max-age=3600')
  return frame.data
})
