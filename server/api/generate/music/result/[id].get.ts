import { getRouterParam, createError, setHeader } from 'h3'
import { readMusicGenerationResult } from '~/server/utils/music-generation-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing result id' })
  }

  const result = await readMusicGenerationResult(id)
  if (!result) {
    throw createError({ statusCode: 404, message: 'Generated audio not found or expired' })
  }

  setHeader(event, 'Content-Type', result.mime)
  setHeader(event, 'Cache-Control', 'private, max-age=3600')
  return result.data
})
