import { createError, readMultipartFormData } from 'h3'
import { conceptReferenceImagePublicUrl } from '~/lib/concept-reference-image-ref'
import { compressImageBufferForVideoSeed } from '~/server/utils/compress-image-for-video-seed'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  newConceptReferenceImageId,
  pruneOldConceptReferenceImages,
  saveConceptReferenceImage
} from '~/server/utils/concept-reference-image-store'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
/** Accept large uploads; server compresses before storage. */
const UPLOAD_MAX_BEFORE_COMPRESS = 12_000_000

export default defineEventHandler(async (event) => {
  await getPocketBaseUserIdFromRequest(event)
  void pruneOldConceptReferenceImages()

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
      message: 'Reference image file is too large (max 12MB). Use a smaller image.'
    })
  }

  const id = newConceptReferenceImageId()
  let staged: Buffer
  let outMime = 'image/jpeg'
  try {
    const compressed = await compressImageBufferForVideoSeed(fileBuf)
    staged = compressed.data
    outMime = compressed.mime
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode
    if (status === 413) {
      throw createError({
        statusCode: 413,
        message: 'Reference image is too large after compression. Use a smaller image.'
      })
    }
    throw e
  }

  await saveConceptReferenceImage(id, staged, outMime)

  return { url: conceptReferenceImagePublicUrl(id) }
})
