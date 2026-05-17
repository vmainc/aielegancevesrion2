import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import { extractComparableTitlesFromTreatment, fetchOmdbMovie } from '~/server/utils/script-wizard-omdb'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing project id' })
    }
    const userId = await getPocketBaseUserIdFromRequest(event)
    const pb = await getAuthenticatedPocketBase()

    let project: unknown
    try {
      project = await pb.collection('creative_projects').getOne(id)
    } catch (e: unknown) {
      if (isPocketBaseMissingCollectionError(e)) {
        return { candidates: [], movies: [], omdbConfigured: false, warning: 'creative_projects collection missing' }
      }
      const st = pocketBaseErrorStatus(e)
      if (st === 404) {
        throw createError({ statusCode: 404, message: 'Project not found' })
      }
      throw e
    }

    const owner = pbRecordOwnerId(project as { owned_by?: unknown; owner?: unknown; user?: unknown })
    if (owner !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }

    const treatment = String((project as { treatment?: unknown }).treatment || '')
    const candidates = extractComparableTitlesFromTreatment(treatment)

    const apiKey = String(useRuntimeConfig().omdbApiKey || '').trim()
    const omdbConfigured = Boolean(apiKey)
    if (!apiKey) {
      return { candidates, movies: [], omdbConfigured }
    }

    const movies = (
      await Promise.all(
        candidates.map(async (c) => {
          try {
            const m = await fetchOmdbMovie({ apiKey, title: c.title, year: c.year })
            return m
          } catch {
            return null
          }
        })
      )
    ).filter((x): x is NonNullable<typeof x> => Boolean(x))

    return { candidates, movies, omdbConfigured }
  } catch (e: unknown) {
    const status = pocketBaseErrorStatus(e)
    if (status === 400 || status === 401 || status === 403 || status === 404) throw e
    if (isPocketBaseMissingCollectionError(e)) {
      return { candidates: [], movies: [], omdbConfigured: false, warning: 'creative_projects collection missing' }
    }
    return {
      candidates: [],
      movies: [],
      omdbConfigured: Boolean(String(useRuntimeConfig().omdbApiKey || '').trim()),
      warning: 'Movies lookup unavailable right now; try refresh later.'
    }
  }
})
