import { createError, getQuery, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import {
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const q = getQuery(event)
  const kind = typeof q.kind === 'string' ? q.kind.trim() : ''
  const kindOk = kind && ['script', 'character', 'storyboard', 'video', 'other'].includes(kind)

  const mapRows = (rows: unknown[]) =>
    rows.map((r) => pbRecordToProjectAsset(r as Record<string, unknown>, pb))

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
    const msg = e instanceof Error ? e.message : String(e)
    throw createError({ statusCode: st || 500, message: msg || 'Could not list project assets' })
  }
})
