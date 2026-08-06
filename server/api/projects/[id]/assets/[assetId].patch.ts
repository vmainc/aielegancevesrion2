import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'
import type { ProjectAssetKind } from '~/types/project-asset'

const KINDS: ProjectAssetKind[] = ['script', 'character', 'storyboard', 'video', 'other']

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const assetId = getRouterParam(event, 'assetId')
  if (!projectId || !assetId) {
    throw createError({ statusCode: 400, message: 'Missing project or asset id' })
  }
  const { pb, access } = await requireProjectOwner(event, projectId)

  const existing = await pb.collection('project_assets').getOne(assetId)
  const p = typeof existing.project === 'string' ? existing.project : (existing.project as { id?: string })?.id
  if (p !== projectId) {
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
  const asset = pbRecordToProjectAsset(updated as Record<string, unknown>, pb)
  await syncProjectToBibleSafe({
    pb,
    userId: access.ownerId,
    projectId,
    scopes: ['assets', 'characters']
  })
  return { asset }
})
