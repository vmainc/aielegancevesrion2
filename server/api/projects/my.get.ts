import { createError } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

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

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  try {
    const items = await pb.collection('creative_projects').getFullList({
      // Only `owned_by` exists on schema from setup-collections — OR on missing fields returns 400 from PB.
      filter: `owned_by = "${userId}"`,
      sort: '-created',
      requestKey: `creative_my_${userId}`
    })
    return {
      items: items.map(r => pbRecordToCreativeProject(r as Parameters<typeof pbRecordToCreativeProject>[0]))
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = pocketBaseErrorStatus(e)
    if (isPocketBaseMissingCollectionError(e)) {
      // Graceful fallback so app remains usable even before PB collections are provisioned.
      return { items: [], warning: 'creative_projects collection missing' }
    }
    // PocketBase often returns 400 when filter syntax does not match the live schema (e.g. legacy field types).
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
        const mine = all.filter((r) => pbRecordOwnerId(r) === userId)
        return {
          items: mine.map(rec =>
            pbRecordToCreativeProject(rec as Parameters<typeof pbRecordToCreativeProject>[0])
          ),
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
