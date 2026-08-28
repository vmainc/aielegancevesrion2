import { createError, getRouterParam } from 'h3'
import { listShotVideoVersions } from '~/lib/video-repair/versions'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import type { ProjectAsset } from '~/types/project-asset'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const shotId = getRouterParam(event, 'shotId')
  if (!projectId || !shotId) {
    throw createError({ statusCode: 400, message: 'Missing project or shot id' })
  }
  const { userId, pb } = await requireProjectOwner(event, projectId)
  const items = await listProjectAssetsForProject(pb, projectId, userId, { kind: 'video' })
  const assets: ProjectAsset[] = items.map(r => pbRecordToProjectAsset(r as Record<string, unknown>, pb))
  return { versions: listShotVideoVersions(assets, shotId) }
})
