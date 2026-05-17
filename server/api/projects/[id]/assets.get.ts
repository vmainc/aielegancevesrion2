import { createError, getQuery, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import type { ProjectAsset } from '~/types/project-asset'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  let project: unknown
  try {
    project = await pb.collection('creative_projects').getOne(projectId)
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'creative_projects collection is missing or not provisioned on PocketBase.'
      })
    }
    if (pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: 'Project not found' })
    }
    throw e
  }
  const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

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
