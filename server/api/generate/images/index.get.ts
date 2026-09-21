import { createError, getQuery } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToImageGeneration } from '~/server/utils/image-generation-map'
import {
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import { stagedGeneratedImagePublicPath } from '~/server/utils/image-generation-store'
import type { ImageGenerationCategory } from '~/types/image-generation'

const CATEGORIES = new Set<ImageGenerationCategory>([
  'characters',
  'locations',
  'storyboards',
  'props',
  'concept_art',
  'other'
])

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const query = getQuery(event)
  const projectId = typeof query.projectId === 'string' ? query.projectId.trim() : ''
  const category = typeof query.category === 'string' ? query.category.trim() : ''
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(48, Math.max(1, Number(query.perPage) || 24))

  const pb = await getAuthenticatedPocketBase()
  const filters = [`owned_by = "${userId}"`]
  if (projectId) filters.push(`project = "${projectId}"`)
  if (category && CATEGORIES.has(category as ImageGenerationCategory)) {
    filters.push(`category = "${category}"`)
  }

  try {
    const list = await pb.collection('image_generations').getList(page, perPage, {
      filter: filters.join(' && '),
      sort: '-created'
    })

    const items = list.items.map((row) => {
      const record = row as unknown as Record<string, unknown>
      const gen = pbRecordToImageGeneration(record, {
        pbFilesBase: (r, filename) => pb.files.getURL(r as never, filename)
      })
      const settings = gen.generationSettings || {}
      const stageId =
        typeof settings.stage_id === 'string' ? settings.stage_id : ''
      if (stageId && gen.status === 'complete' && gen.imageCount > 0) {
        gen.imageUrls = Array.from({ length: gen.imageCount }, (_, i) =>
          stagedGeneratedImagePublicPath(stageId, i)
        )
      }
      return gen
    })

    return {
      items,
      page: list.page,
      perPage: list.perPage,
      totalItems: list.totalItems,
      totalPages: list.totalPages
    }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      return {
        items: [],
        page: 1,
        perPage,
        totalItems: 0,
        totalPages: 0,
        notice: 'image_generations collection is not set up yet. Run npm run setup-db or add-fields.'
      }
    }
    if (pocketBaseErrorStatus(e) === 400) {
      throw createError({ statusCode: 400, message: 'Invalid history filter' })
    }
    throw e
  }
})
