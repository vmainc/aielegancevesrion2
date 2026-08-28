import { createError, readMultipartFormData } from 'h3'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pruneOldVideoRepairMedia, videoRepairResultPath } from '~/server/utils/video-repair-media-store'
import { stageBufferAsRepairMedia } from '~/server/utils/video-repair-source'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 8_000_000

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  checkRateLimit(rateLimitKey(userId, 'repair-frame'), 30, 60_000)
  void pruneOldVideoRepairMedia()

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, message: 'Expected an image file.' })
  }

  let fileBuf: Buffer | null = null
  let mime = 'image/jpeg'
  let timestampSeconds: number | null = null

  for (const part of parts) {
    if (!part.name) continue
    if (part.name === 'file' && part.data?.length) {
      fileBuf = part.data
      const ct = (part.type || '').split(';')[0]?.trim().toLowerCase()
      if (ct && ALLOWED.has(ct)) mime = ct
    }
    if (part.name === 'timestampSeconds' && part.data) {
      const n = Number(part.data.toString('utf8'))
      if (Number.isFinite(n) && n >= 0) timestampSeconds = n
    }
  }

  if (!fileBuf?.length) {
    throw createError({ statusCode: 400, message: 'Missing reference image.' })
  }
  if (fileBuf.length > MAX_BYTES) {
    throw createError({ statusCode: 413, message: 'Reference image is too large (max 8MB).' })
  }

  const staged = await stageBufferAsRepairMedia(fileBuf, mime)
  return {
    mediaId: staged.mediaId,
    mime: staged.mime,
    playbackUrl: videoRepairResultPath(staged.mediaId),
    timestampSeconds
  }
})
