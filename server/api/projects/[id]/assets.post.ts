import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import type { ProjectAssetKind } from '~/types/project-asset'

const KINDS: ProjectAssetKind[] = ['script', 'character', 'storyboard', 'video', 'other']

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

  const body = await readBody<{
    kind?: string
    title?: string
    notes?: string
    metadata?: Record<string, unknown>
    sort_order?: number
  }>(event)

  const kind = typeof body?.kind === 'string' && KINDS.includes(body.kind as ProjectAssetKind)
    ? (body.kind as ProjectAssetKind)
    : null
  if (!kind) {
    throw createError({
      statusCode: 400,
      message: `kind is required (${KINDS.join(', ')})`
    })
  }

  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!title) {
    throw createError({ statusCode: 400, message: 'title is required' })
  }

  const notes = typeof body?.notes === 'string' ? body.notes : ''
  const metadata =
    body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : undefined
  const sortOrder = typeof body?.sort_order === 'number' && body.sort_order >= 0 ? body.sort_order : 0

  try {
    const created = await pb.collection('project_assets').create({
      owned_by: userId,
      project: projectId,
      kind,
      title: title.slice(0, 500),
      notes: notes.slice(0, 20000),
      metadata: metadata ?? null,
      sort_order: sortOrder
    })
    return {
      asset: pbRecordToProjectAsset(created as Record<string, unknown>, pb)
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e)
    if (/wasn't found|not found|404|Missing collection/i.test(msg)) {
      throw createError({
        statusCode: 503,
        message:
          'project_assets collection is missing. Run: node scripts/setup-collections.js (adds project_assets).'
      })
    }
    throw createError({ statusCode: 500, message: msg })
  }
})
