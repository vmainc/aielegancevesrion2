import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'

const PB_ID = /^[a-z0-9]{15}$/

export default defineEventHandler(async (event) => {
  const assetId = getRouterParam(event, 'assetId')
  if (!assetId) {
    throw createError({ statusCode: 400, message: 'Missing asset id' })
  }

  const body = await readBody(event).catch(() => ({}))
  const targetProjectId =
    typeof body?.projectId === 'string'
      ? body.projectId.trim()
      : typeof body?.targetProjectId === 'string'
        ? body.targetProjectId.trim()
        : ''

  if (!targetProjectId || !PB_ID.test(targetProjectId)) {
    throw createError({ statusCode: 400, message: 'Valid target project id is required' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  let existing: Record<string, unknown>
  try {
    existing = (await pb.collection('project_assets').getOne(assetId)) as Record<string, unknown>
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status
    if (status === 404) {
      throw createError({ statusCode: 404, message: 'Asset not found' })
    }
    throw e
  }

  const owner = pbRecordOwnerId(existing as { owned_by?: unknown; owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const currentProjectId =
    typeof existing.project === 'string'
      ? existing.project
      : existing.project && typeof existing.project === 'object' && 'id' in existing.project
        ? String((existing.project as { id: string }).id)
        : ''

  if (currentProjectId === targetProjectId) {
    throw createError({ statusCode: 400, message: 'Clip is already in that project' })
  }

  let targetProject: Record<string, unknown>
  try {
    targetProject = (await pb.collection('creative_projects').getOne(targetProjectId)) as Record<string, unknown>
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status
    if (status === 404) {
      throw createError({ statusCode: 404, message: 'Target project not found' })
    }
    throw e
  }

  const targetOwner = pbRecordOwnerId(targetProject as { owner?: unknown; user?: unknown })
  if (targetOwner !== userId) {
    throw createError({ statusCode: 403, message: 'You do not have access to that project' })
  }

  const updated = await pb.collection('project_assets').update(assetId, {
    project: targetProjectId
  })

  return {
    asset: pbRecordToProjectAsset(updated as Record<string, unknown>, pb)
  }
})
