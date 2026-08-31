import { createError, getQuery, getRouterParam, setHeader, setResponseStatus } from 'h3'
import { findVideoRepairJobByPublicToken } from '~/server/utils/video-repair-job-store'
import { readVideoRepairMedia } from '~/server/utils/video-repair-media-store'

/**
 * Unauthenticated fetch for providers (OpenRouter / Luma). Token is a one-job secret.
 */
export default defineEventHandler(async (event) => {
  const token = String(getRouterParam(event, 'token') || '').trim()
  const job = await findVideoRepairJobByPublicToken(token)
  if (!job) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  const kind = String(getQuery(event).kind || 'source').trim()
  const mediaId = kind === 'reference' ? job.referenceMediaId : job.sourceMediaId
  if (!mediaId) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  const staged = await readVideoRepairMedia(mediaId)
  if (!staged) {
    throw createError({ statusCode: 404, message: 'Expired' })
  }
  setHeader(event, 'Content-Type', staged.mime || 'video/mp4')
  setHeader(event, 'Content-Length', String(staged.data.length))
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  setHeader(event, 'Accept-Ranges', 'bytes')
  setResponseStatus(event, 200)
  return staged.data
})
