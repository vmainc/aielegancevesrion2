import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { requireImageGenerationId } from '~/server/utils/image-generation-persist'
import {
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const id = requireImageGenerationId(getRouterParam(event, 'id') || '')
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
    await pb.collection('image_generations').delete(id)
    return { ok: true }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'image_generations collection is not set up yet.'
      })
    }
    if (pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: 'Generation not found' })
    }
    throw e
  }
})
