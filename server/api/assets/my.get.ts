import { createError, getQuery } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'

async function listProjectAssetsRecordsForHub (
  pb: Awaited<ReturnType<typeof getAuthenticatedPocketBase>>,
  userId: string,
  kind: string
): Promise<{ records: Array<Record<string, unknown>>; allListAttemptsWere400: boolean }> {
  const reqKey = `assets_my_fallback_${userId}_${kind}`
  const tries = [
    () =>
      pb.collection('project_assets').getFullList({
        sort: '-created',
        batch: 500,
        expand: 'project',
        requestKey: reqKey
      }),
    () =>
      pb.collection('project_assets').getFullList({
        sort: '-updated',
        batch: 500,
        expand: 'project',
        requestKey: reqKey
      }),
    () => pb.collection('project_assets').getFullList({ batch: 200, expand: 'project', requestKey: reqKey }),
    () => pb.collection('project_assets').getFullList({ expand: 'project', requestKey: reqKey }),
    () => pb.collection('project_assets').getFullList({ sort: '-created', batch: 500, requestKey: reqKey }),
    () => pb.collection('project_assets').getFullList({ requestKey: reqKey })
  ]
  let lastNon400: unknown
  for (const run of tries) {
    try {
      const rows = await run()
      return { records: rows as Array<Record<string, unknown>>, allListAttemptsWere400: false }
    } catch (e) {
      if (pocketBaseErrorStatus(e) === 400) continue
      lastNon400 = e
      break
    }
  }
  if (lastNon400) throw lastNon400
  return { records: [], allListAttemptsWere400: true }
}

/**
 * All assets for the signed-in user (across projects), for /assets hub.
 */
export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()
  const q = getQuery(event)
  const kind = typeof q.kind === 'string' ? q.kind.trim() : ''

  let filter = `owned_by = "${userId}"`
  if (kind && ['script', 'character', 'storyboard', 'video', 'other'].includes(kind)) {
    filter += ` && kind = "${kind}"`
  }

  try {
    const items = await pb.collection('project_assets').getFullList({
      filter,
      sort: '-created',
      expand: 'project',
      requestKey: `assets_my_${userId}_${kind}`
    })
    return {
      items: items.map((r) => {
        const mapped = pbRecordToProjectAsset(r as Record<string, unknown>, pb)
        const exp = (r as { expand?: { project?: { name?: string } } }).expand
        if (exp?.project?.name) {
          mapped.projectName = exp.project.name
        }
        return mapped
      })
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e)
    const status = pocketBaseErrorStatus(e)
    if (isPocketBaseMissingCollectionError(e)) {
      // Graceful fallback so Assets pages remain usable while PB schema is being provisioned.
      return { items: [], warning: 'project_assets collection missing' }
    }
    if (status === 400) {
      try {
        const { records: all, allListAttemptsWere400 } = await listProjectAssetsRecordsForHub(pb, userId, kind)
        if (allListAttemptsWere400) {
          return {
            items: [],
            warning:
              'Could not read project_assets from PocketBase (400 on every list attempt). Run: node scripts/setup-collections.js against http://127.0.0.1:8090'
          }
        }
        let rows = all.filter(r => pbRecordOwnerId(r) === userId)
        if (kind && ['script', 'character', 'storyboard', 'video', 'other'].includes(kind)) {
          rows = rows.filter(r => String(r.kind || '') === kind)
        }
        return {
          items: rows.map((r) => {
            const mapped = pbRecordToProjectAsset(r, pb)
            const exp = (r as { expand?: { project?: { name?: string } } }).expand
            if (exp?.project?.name) {
              mapped.projectName = exp.project.name
            }
            return mapped
          }),
          warning:
            'project_assets filter query failed (400); listed your assets using an in-memory filter. Run node scripts/add-fields-to-collections.js if the schema is out of date.'
        }
      } catch (e2: unknown) {
        throw createError({ statusCode: pocketBaseErrorStatus(e2) || 500, message: e2 instanceof Error ? e2.message : String(e2) })
      }
    }
    throw createError({ statusCode: status || 500, message: msg })
  }
})
