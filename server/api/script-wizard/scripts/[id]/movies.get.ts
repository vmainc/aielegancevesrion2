import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { extractComparableTitlesFromTreatment, fetchOmdbMovie } from '~/server/utils/script-wizard-omdb'

function isMissingCollectionError (e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  const status = e && typeof e === 'object' && 'status' in e ? Number((e as { status?: number }).status || 0) : 0
  return status === 404 || /missing collection context|wasn't found|not found|missing collection/i.test(msg)
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing script id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()
  let candidates: Array<{ title: string; year?: string }> = []
  try {
    const script = await pb.collection('creative_scripts').getOne(id)
    const owner = pbRecordOwnerId(script as { owned_by?: unknown; owner?: unknown; user?: unknown })
    if (owner !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    const treatment = String((script as { treatment?: unknown }).treatment || '')
    candidates = extractComparableTitlesFromTreatment(treatment)
  } catch (e: unknown) {
    if (!isMissingCollectionError(e)) {
      throw e
    }
    const asset = await pb.collection('project_assets').getOne(id)
    const owner = pbRecordOwnerId(asset as { owned_by?: unknown; owner?: unknown; user?: unknown })
    if (owner !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    const rawMeta = (asset as { metadata?: unknown }).metadata
    const meta = rawMeta && typeof rawMeta === 'object'
      ? (rawMeta as Record<string, unknown>)
      : {}
    const treatment = String(meta.treatment || '')
    candidates = extractComparableTitlesFromTreatment(treatment)
    if (!candidates.length && Array.isArray(meta.comparable_titles)) {
      candidates = (meta.comparable_titles as Array<Record<string, unknown>>)
        .map(c => ({ title: String(c.title || ''), year: String(c.year || '') || undefined }))
        .filter(c => c.title)
        .slice(0, 8)
    }
  }
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

