import { createError, getQuery, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import type { ProjectAsset } from '~/types/project-asset'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const { userId, pb } = await requireProjectOwner(event, projectId)

  const q = getQuery(event)
  const kind = typeof q.kind === 'string' ? q.kind.trim() : ''
  const kindOk = kind && ['script', 'character', 'storyboard', 'video', 'other'].includes(kind)

  const mapRows = (rows: unknown[]) => {
    const out: ReturnType<typeof pbRecordToProjectAsset>[] = []
    for (const r of rows) {
      try {
        out.push(pbRecordToProjectAsset(r as Record<string, unknown>, pb))
      } catch (err) {
        console.warn('[project assets] skipped row:', formatPocketBaseRecordError(err))
      }
    }
    return out
  }

  try {
    const items = await listProjectAssetsForProject(
      pb,
      projectId,
      userId,
      kindOk ? { kind } : undefined
    )
    return { items: mapRows(items) }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message:
          'project_assets collection is missing. Run: node scripts/setup-collections.js (adds project_assets).'
      })
    }
    const st = pocketBaseErrorStatus(e)
    if (st === 401 || st === 403) {
      const msg = formatPocketBaseRecordError(e)
      throw createError({ statusCode: st, message: msg || 'Could not list project assets' })
    }
    console.error('[project assets] list failed:', formatPocketBaseRecordError(e))
    return {
      items: [] as ProjectAsset[],
      warning: formatPocketBaseRecordError(e) || 'Could not list project assets. Try again or check PocketBase logs.'
    }
  }
})
