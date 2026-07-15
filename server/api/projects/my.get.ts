import { createError } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { listSharedProjectIdsForUser } from '~/server/utils/project-access'

async function listCreativeProjectsRecords (
  pb: Awaited<ReturnType<typeof getAuthenticatedPocketBase>>
): Promise<{ records: Array<Record<string, unknown>>; allListAttemptsWere400: boolean }> {
  const tries = [
    () => pb.collection('creative_projects').getFullList({ sort: '-created', batch: 500 }),
    () => pb.collection('creative_projects').getFullList({ sort: '-updated', batch: 500 }),
    () => pb.collection('creative_projects').getFullList({ batch: 200 }),
    () => pb.collection('creative_projects').getFullList()
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

function mapProjectWithRole (
  rec: Record<string, unknown>,
  userId: string,
  sharedIds: Set<string>
) {
  const isOwner = pbRecordOwnerId(rec) === userId
  const accessRole = isOwner ? 'owner' as const : sharedIds.has(String(rec.id || '')) ? 'member' as const : undefined
  if (!accessRole) return null
  return pbRecordToCreativeProject(
    rec as Parameters<typeof pbRecordToCreativeProject>[0],
    { accessRole }
  )
}

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const sharedIds = new Set(await listSharedProjectIdsForUser(pb, userId))

  try {
    const [ownedItems, sharedProjectIds] = await Promise.all([
      pb.collection('creative_projects').getFullList({
        filter: `owned_by = "${userId}"`,
        sort: '-created',
        requestKey: `creative_my_${userId}`
      }),
      sharedIds.size
        ? pb.collection('creative_projects').getFullList({
            filter: sharedIds.size === 1
              ? `id = "${[...sharedIds][0]}"`
              : sharedIds.size <= 20
                ? [...sharedIds].map(id => `id = "${id}"`).join(' || ')
                : undefined,
            sort: '-created',
            requestKey: `creative_shared_${userId}`
          }).catch(() => [])
        : Promise.resolve([])
    ])

    const seen = new Set<string>()
    const items = []
    for (const rec of ownedItems as Array<Record<string, unknown>>) {
      const id = String(rec.id || '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      items.push(pbRecordToCreativeProject(rec as Parameters<typeof pbRecordToCreativeProject>[0], { accessRole: 'owner' }))
    }
    for (const rec of sharedProjectIds as Array<Record<string, unknown>>) {
      const id = String(rec.id || '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      items.push(pbRecordToCreativeProject(rec as Parameters<typeof pbRecordToCreativeProject>[0], { accessRole: 'member' }))
    }

    // If shared filter was too large, fetch individually
    if (sharedIds.size > 20) {
      for (const pid of sharedIds) {
        if (seen.has(pid)) continue
        try {
          const rec = await pb.collection('creative_projects').getOne(pid) as Record<string, unknown>
          seen.add(pid)
          items.push(pbRecordToCreativeProject(rec as Parameters<typeof pbRecordToCreativeProject>[0], { accessRole: 'member' }))
        } catch {
          /* skip missing */
        }
      }
    }

    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return { items }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = pocketBaseErrorStatus(e)
    if (isPocketBaseMissingCollectionError(e)) {
      return { items: [], warning: 'creative_projects collection missing' }
    }
    if (status === 400) {
      try {
        const { records: all, allListAttemptsWere400 } = await listCreativeProjectsRecords(pb)
        if (allListAttemptsWere400) {
          return {
            items: [],
            warning:
              'Could not read creative_projects from PocketBase (400 on every list attempt). Run: node scripts/setup-collections.js against http://127.0.0.1:8090'
          }
        }
        const items = all
          .map(rec => mapProjectWithRole(rec, userId, sharedIds))
          .filter((p): p is NonNullable<typeof p> => p !== null)
        items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        return {
          items,
          warning:
            'creative_projects PocketBase filter failed (400); listed your projects using an in-memory filter. Run node scripts/add-fields-to-collections.js if the schema is out of date.'
        }
      } catch (e2: unknown) {
        const m2 = e2 instanceof Error ? e2.message : String(e2)
        throw createError({ statusCode: pocketBaseErrorStatus(e2) || 500, message: m2 })
      }
    }
    throw createError({
      statusCode: status || 500,
      message: msg
    })
  }
})
