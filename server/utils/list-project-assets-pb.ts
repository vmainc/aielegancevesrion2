import type PocketBase from 'pocketbase'
import {
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'

function projectIdOnAsset (raw: Record<string, unknown>): string {
  const p = raw.project
  if (typeof p === 'string') return p
  if (p && typeof p === 'object' && 'id' in p && typeof (p as { id?: string }).id === 'string') {
    return (p as { id: string }).id
  }
  return ''
}

/**
 * List `project_assets` for a project with PocketBase-friendly fallbacks.
 * Some PB versions or rules reject compound filters or certain sort fields; we retry with simpler queries.
 */
export async function listProjectAssetsForProject (
  pb: PocketBase,
  projectId: string,
  _userId: string,
  options?: { kind?: string }
): Promise<unknown[]> {
  const kind = options?.kind?.trim()
  let filter = `project = "${projectId}"`
  if (kind) {
    filter += ` && kind = "${kind}"`
  }

  const filterInMemory = (rows: unknown[]) =>
    rows.filter((r) => {
      const row = r as Record<string, unknown>
      if (projectIdOnAsset(row) !== projectId) return false
      if (!kind) return true
      return String(row.kind || '') === kind
    })

  const filterProjectOnly = `project = "${projectId}"`
  const reqKey = `list_pa_${projectId}_${kind || 'all'}`

  const tries: Array<() => Promise<unknown[]>> = [
    () =>
      pb.collection('project_assets').getFullList({
        filter,
        sort: '-created',
        batch: 200
      }),
    () =>
      pb.collection('project_assets').getFullList({
        filter,
        batch: 200
      }),
    // kind in SQL can 400 on some deployments — omit kind in query and filter in memory
    async () => {
      const all = await pb.collection('project_assets').getFullList({
        filter: filterProjectOnly,
        sort: '-created',
        batch: 400,
        requestKey: `${reqKey}_nokind`
      })
      return filterInMemory(all)
    },
    async () => {
      const all = await pb.collection('project_assets').getFullList({
        filter: filterProjectOnly,
        batch: 400,
        requestKey: `${reqKey}_nokind2`
      })
      return filterInMemory(all)
    },
    async () => {
      const all = await pb.collection('project_assets').getFullList({
        filter: filterProjectOnly,
        sort: '-created',
        batch: 400,
        requestKey: reqKey
      })
      return filterInMemory(all)
    },
    async () => {
      const all = await pb.collection('project_assets').getFullList({
        filter: filterProjectOnly,
        batch: 400,
        requestKey: `${reqKey}_batch`
      })
      return filterInMemory(all)
    }
  ]

  let lastErr: unknown
  for (let i = 0; i < tries.length; i++) {
    const run = tries[i]
    try {
      const rows = await run()
      if (rows.length > 0) {
        return rows
      }
      // Success but empty: stricter filters (e.g. kind in SQL) often miss legacy rows — try next strategy.
      if (i < tries.length - 1) {
        continue
      }
      return rows
    } catch (e: unknown) {
      lastErr = e
      if (isPocketBaseMissingCollectionError(e)) {
        throw e
      }
      const st = pocketBaseErrorStatus(e)
      if (st === 401 || st === 403) {
        throw e
      }
      // Retry: 400 (bad filter), 500 (transient), etc.
      continue
    }
  }
  if (lastErr !== undefined && lastErr !== null) {
    throw lastErr
  }
  return []
}
