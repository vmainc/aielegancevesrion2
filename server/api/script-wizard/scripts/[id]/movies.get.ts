import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { extractComparableTitlesFromTreatment, fetchOmdbMovie } from '~/server/utils/script-wizard-omdb'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing script id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()
  const script = await pb.collection('creative_scripts').getOne(id)
  const owner = pbRecordOwnerId(script as { owned_by?: unknown; owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const treatment = String((script as { treatment?: unknown }).treatment || '')
  const candidates = extractComparableTitlesFromTreatment(treatment)
  const apiKey = String(useRuntimeConfig().omdbApiKey || '').trim()
  if (!apiKey) {
    return { candidates, movies: [] }
  }

  const movies = (
    await Promise.all(
      candidates.map(async (c) => {
        try {
          return await fetchOmdbMovie({ apiKey, title: c.title, year: c.year })
        } catch {
          return null
        }
      })
    )
  ).filter((x): x is NonNullable<typeof x> => Boolean(x))

  return { candidates, movies }
})

