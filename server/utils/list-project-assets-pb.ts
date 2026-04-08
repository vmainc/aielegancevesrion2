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
  userId: string,
  options?: { kind?: string }
): Promise<unknown[]> {
  const kind = options?.kind?.trim()
  let filter = `project = "${projectId}" && owned_by = "${userId}"`
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
    async () => {
      const all = await pb.collection('project_assets').getFullList({
        filter: `owned_by = "${userId}"`,
        sort: '-created',
        batch: 400
      })
      return filterInMemory(all)
    }
  ]

  let lastErr: unknown
  for (const run of tries) {
    try {
      return await run()
    } catch (e: unknown) {
      lastErr = e
      if (isPocketBaseMissingCollectionError(e)) {
        throw e
      }
      const st = pocketBaseErrorStatus(e)
      if (st === 401 || st === 403) {
        throw e
      }
    }
  }
  throw lastErr
}
