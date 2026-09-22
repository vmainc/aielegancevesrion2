import { getRouterParam, createError, setHeader } from 'h3'
import { readVoiceoverGenerationResult } from '~/server/utils/voiceover-generation-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing result id' })
  }

  const result = await readVoiceoverGenerationResult(id)
  if (!result) {
    throw createError({ statusCode: 404, message: 'Generated voiceover not found or expired' })
  }

  setHeader(event, 'Content-Type', result.mime)
  setHeader(event, 'Cache-Control', 'private, max-age=3600')
  return result.data
})
