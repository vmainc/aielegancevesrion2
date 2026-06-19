import { readMultipartFormData, createError } from 'h3'
import { videoStartFramePublicUrl } from '~/lib/video-start-frame-ref'
import { VIDEO_SEED_FRAME_TOO_LARGE_MESSAGE } from '~/lib/video-start-frame-limits'
import { compressImageBufferForVideoSeed } from '~/server/utils/compress-image-for-video-seed'
import {
  newVideoStartFrameId,
  pruneOldVideoStartFrames,
  saveVideoStartFrame
} from '~/server/utils/video-start-frame-store'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
/** Accept larger uploads; server compresses down to video seed limit. */
const UPLOAD_MAX_BEFORE_COMPRESS = 12_000_000

export default defineEventHandler(async (event) => {
  void pruneOldVideoStartFrames()

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, message: 'Expected multipart form with a file field' })
  }

  let fileBuf: Buffer | null = null
  let mime = 'image/jpeg'

  for (const part of parts) {
    if (part.name !== 'file' || !part.data?.length) continue
    fileBuf = part.data
    const ct = (part.type || '').split(';')[0]?.trim().toLowerCase()
    if (ct && ALLOWED_MIME.has(ct)) mime = ct
    break
  }

  if (!fileBuf?.length) {
    throw createError({ statusCode: 400, message: 'Missing image file' })
  }
  if (fileBuf.length > UPLOAD_MAX_BEFORE_COMPRESS) {
    throw createError({
      statusCode: 413,
      message: VIDEO_SEED_FRAME_TOO_LARGE_MESSAGE
    })
  }

  const id = newVideoStartFrameId()
  let staged: Buffer
  let outMime = 'image/jpeg'
  try {
    const compressed = await compressImageBufferForVideoSeed(fileBuf)
    staged = compressed.data
    outMime = compressed.mime
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode
    if (status === 413) {
      throw createError({ statusCode: 413, message: VIDEO_SEED_FRAME_TOO_LARGE_MESSAGE })
    }
    throw e
  }

  await saveVideoStartFrame(id, staged, outMime)

  return { url: videoStartFramePublicUrl(id) }
})
