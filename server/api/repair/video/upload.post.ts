import { createError, readMultipartFormData } from 'h3'
import {
  isAllowedRepairVideoFilename,
  isAllowedRepairVideoMime,
  mimeFromRepairFilename
} from '~/lib/video-repair/limits'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { getVideoRepairLimits, getVideoRepairMaxBytes } from '~/server/utils/video-repair-config'
import { pruneOldVideoRepairMedia, videoRepairResultPath } from '~/server/utils/video-repair-media-store'
import { stageBufferAsRepairMedia } from '~/server/utils/video-repair-source'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  checkRateLimit(rateLimitKey(userId, 'repair-upload'), 12, 60_000)
  void pruneOldVideoRepairMedia()

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, message: 'Expected a video file upload.' })
  }

  let fileBuf: Buffer | null = null
  let filename = 'clip.mp4'
  let mime = ''
  let durationSeconds = 0

  for (const part of parts) {
    if (!part.name) continue
    if (part.name === 'file' && part.data?.length && part.filename) {
      fileBuf = part.data
      filename = part.filename
      mime = (part.type || '').split(';')[0]?.trim().toLowerCase() || ''
    }
    if (part.name === 'durationSeconds' && part.data) {
      durationSeconds = Number(part.data.toString('utf8'))
    }
  }

  if (!fileBuf?.length) {
    throw createError({ statusCode: 400, message: 'Missing video file.' })
  }

  const allowed =
    isAllowedRepairVideoMime(mime || mimeFromRepairFilename(filename)) ||
    isAllowedRepairVideoFilename(filename)
  if (!allowed) {
    throw createError({
      statusCode: 400,
      message: 'Unsupported file type. Upload MP4, MOV, or WebM.'
    })
  }

  const maxBytes = getVideoRepairMaxBytes()
  if (fileBuf.length > maxBytes) {
    throw createError({
      statusCode: 413,
      message: `Video is too large (max ${getVideoRepairLimits().maxUploadMb}MB).`
    })
  }

  const { maxDurationSeconds } = getVideoRepairLimits()
  if (Number.isFinite(durationSeconds) && durationSeconds > maxDurationSeconds) {
    throw createError({
      statusCode: 400,
      message: `Clip is too long (max ${maxDurationSeconds}s). Trim it before repairing.`
    })
  }

  const resolvedMime = isAllowedRepairVideoMime(mime) ? mime : mimeFromRepairFilename(filename)
  const staged = await stageBufferAsRepairMedia(fileBuf, resolvedMime)

  return {
    mediaId: staged.mediaId,
    mime: staged.mime,
    bytes: staged.bytes,
    playbackUrl: videoRepairResultPath(staged.mediaId),
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null
  }
})
