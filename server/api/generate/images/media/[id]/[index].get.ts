import { createError, getRouterParam, setHeader } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { readStagedGeneratedImage } from '~/server/utils/image-generation-store'
import {
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'

/**
 * Serve a generated image by stage id (32-hex) or PocketBase generation id.
 * Auth required (Bearer or access_token query for <img>).
 */
export default defineEventHandler(async (event) => {
  await getPocketBaseUserIdFromRequest(event, { allowAccessTokenQuery: true })
  const id = (getRouterParam(event, 'id') || '').trim()
  const indexRaw = getRouterParam(event, 'index') || '0'
  const index = Number(indexRaw)
  if (!Number.isInteger(index) || index < 0 || index > 15) {
    throw createError({ statusCode: 400, message: 'Invalid image index' })
  }

  // Prefer local stage folder (generation stage id is 32-hex).
  if (/^[a-f0-9]{32}$/i.test(id)) {
    const staged = await readStagedGeneratedImage(id, index)
    if (staged) {
      setHeader(event, 'Content-Type', staged.mime)
      setHeader(event, 'Cache-Control', 'private, max-age=3600')
      return staged.data
    }
  }

  // Fall back to PocketBase record → stage_id in settings, or PB file.
  const userId = await getPocketBaseUserIdFromRequest(event, { allowAccessTokenQuery: true })
  const pb = await getAuthenticatedPocketBase()
  try {
    const record = (await pb.collection('image_generations').getOne(id)) as Record<string, unknown>
    const ownedBy =
      typeof record.owned_by === 'string'
        ? record.owned_by
        : record.owned_by && typeof record.owned_by === 'object' && 'id' in record.owned_by
          ? String((record.owned_by as { id: string }).id)
          : ''
    if (ownedBy !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }

    const settings =
      record.generation_settings && typeof record.generation_settings === 'object'
        ? (record.generation_settings as Record<string, unknown>)
        : {}
    const stageId = typeof settings.stage_id === 'string' ? settings.stage_id : ''
    if (stageId) {
      const staged = await readStagedGeneratedImage(stageId, index)
      if (staged) {
        setHeader(event, 'Content-Type', staged.mime)
        setHeader(event, 'Cache-Control', 'private, max-age=3600')
        return staged.data
      }
    }

    const files = Array.isArray(record.output_images)
      ? record.output_images.filter((x): x is string => typeof x === 'string')
      : typeof record.output_images === 'string' && record.output_images
        ? [record.output_images]
        : []
    const filename = files[index]
    if (!filename) {
      throw createError({ statusCode: 404, message: 'Image not found' })
    }
    const fileUrl = pb.files.getURL(record as never, filename)
    const adminToken = pb.authStore?.token?.trim()
    const upstream = await fetch(fileUrl, {
      headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
    })
    if (!upstream.ok) {
      throw createError({ statusCode: 404, message: 'Image not found' })
    }
    const buf = Buffer.from(await upstream.arrayBuffer())
    setHeader(event, 'Content-Type', upstream.headers.get('content-type') || 'image/png')
    setHeader(event, 'Cache-Control', 'private, max-age=3600')
    return buf
  } catch (e: unknown) {
    if ((e as { statusCode?: number })?.statusCode) throw e
    if (isPocketBaseMissingCollectionError(e) || pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: 'Image not found' })
    }
    throw e
  }
})
