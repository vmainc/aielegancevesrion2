import { readBody, createError } from 'h3'
import { stageImageForVideoStartFrame } from '~/server/utils/stage-image-for-video-start-frame'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({}))
    const url = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!url) {
      throw createError({ statusCode: 400, message: 'url is required' })
    }
    if (url.startsWith('data:')) {
      throw createError({
        statusCode: 400,
        message: 'Use POST /api/generate/video/start-frame with multipart upload for inline image data.'
      })
    }

    const staged = await stageImageForVideoStartFrame(url)
    return { url: staged }
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode
    const message =
      (e as { message?: string })?.message ||
      (e as { statusMessage?: string })?.statusMessage ||
      'Could not prepare starting frame for video'
    if (status && status >= 400 && status < 600) {
      throw createError({ statusCode: status, message })
    }
    console.error('[start-frame-from-url]', e)
    throw createError({ statusCode: 500, message })
  }
})
