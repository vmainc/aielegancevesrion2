import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import type { ProjectAssetKind } from '~/types/project-asset'

const KINDS: ProjectAssetKind[] = ['script', 'character', 'storyboard', 'video', 'other']

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const assetId = getRouterParam(event, 'assetId')
  if (!projectId || !assetId) {
    throw createError({ statusCode: 400, message: 'Missing project or asset id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const existing = await pb.collection('project_assets').getOne(assetId)
  const p = typeof existing.project === 'string' ? existing.project : (existing.project as { id?: string })?.id
  const u = pbRecordOwnerId(existing as { owner?: unknown; user?: unknown })
  if (p !== projectId || u !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const body = await readBody<{
    kind?: string
    title?: string
    notes?: string
    metadata?: Record<string, unknown> | null
    sort_order?: number
  }>(event)

  const patch: Record<string, unknown> = {}
  if (body?.kind != null) {
    if (typeof body.kind === 'string' && KINDS.includes(body.kind as ProjectAssetKind)) {
      patch.kind = body.kind
    } else {
      throw createError({ statusCode: 400, message: `Invalid kind (${KINDS.join(', ')})` })
    }
  }
  if (body?.title != null) {
    const t = typeof body.title === 'string' ? body.title.trim() : ''
    if (!t) throw createError({ statusCode: 400, message: 'title cannot be empty' })
    patch.title = t.slice(0, 500)
  }
  if (body?.notes != null) {
    patch.notes = typeof body.notes === 'string' ? body.notes.slice(0, 20000) : ''
  }
  if (body?.metadata !== undefined) {
    patch.metadata =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata
        : null
  }
  if (body?.sort_order != null) {
    const n = Number(body.sort_order)
    if (!Number.isFinite(n) || n < 0) {
      throw createError({ statusCode: 400, message: 'sort_order must be a non-negative number' })
    }
    patch.sort_order = Math.floor(n)
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  const updated = await pb.collection('project_assets').update(assetId, patch)
  return {
    asset: pbRecordToProjectAsset(updated as Record<string, unknown>, pb)
  }
})
