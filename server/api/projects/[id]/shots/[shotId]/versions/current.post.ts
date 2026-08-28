import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import { assetIsShotVideo, listShotVideoVersions } from '~/lib/video-repair/versions'
import type { ProjectAsset } from '~/types/project-asset'

function str (v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const shotId = getRouterParam(event, 'shotId')
  if (!projectId || !shotId) {
    throw createError({ statusCode: 400, message: 'Missing project or shot id' })
  }
  const { userId, pb } = await requireProjectOwner(event, projectId)
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const assetId = str(body.assetId)
  if (!assetId) throw createError({ statusCode: 400, message: 'assetId is required.' })

  const items = await listProjectAssetsForProject(pb, projectId, userId, { kind: 'video' })
  const assets: ProjectAsset[] = items.map(r => pbRecordToProjectAsset(r as Record<string, unknown>, pb))
  const target = assets.find(a => a.id === assetId)
  if (!target || !assetIsShotVideo(target, shotId)) {
    throw createError({ statusCode: 404, message: 'That version is not part of this shot.' })
  }

  for (const a of assets) {
    if (!assetIsShotVideo(a, shotId)) continue
    const nextMeta = { ...(a.metadata || {}), is_current: a.id === assetId }
    try {
      await pb.collection('project_assets').update(a.id, { metadata: nextMeta })
    } catch (e) {
      console.warn('[video-repair] revert metadata update failed', a.id, e)
    }
  }

  const refreshed = await listProjectAssetsForProject(pb, projectId, userId, { kind: 'video' })
  const mapped = refreshed.map(r => pbRecordToProjectAsset(r as Record<string, unknown>, pb))
  return { versions: listShotVideoVersions(mapped, shotId, assetId), currentAssetId: assetId }
})
