import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import { extractComparableTitlesFromTreatment, fetchOmdbMovie } from '~/server/utils/script-wizard-omdb'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing project id' })
    }

    let pb
    try {
      ;({ pb } = await requireProjectOwner(event, id))
    } catch (e: unknown) {
      if (isPocketBaseMissingCollectionError(e)) {
        return { candidates: [], movies: [], omdbConfigured: false, warning: 'creative_projects collection missing' }
      }
      throw e
    }

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
    if (e && typeof e === 'object' && 'statusCode' in e) {
      const sc = Number((e as { statusCode?: number }).statusCode)
      if (sc === 400 || sc === 401 || sc === 403 || sc === 404) throw e
    }
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
