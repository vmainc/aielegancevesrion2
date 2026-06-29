import { createError, type H3Event } from 'h3'
import type PocketBase from 'pocketbase'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export function bibleRelId (v: string | { id?: string } | undefined): string {
  if (!v) return ''
  return typeof v === 'string' ? v : (v.id || '')
}

export async function requireProjectOwner (
  event: H3Event,
  projectId: string
): Promise<{ userId: string; pb: PocketBase }> {
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  let record: unknown
  try {
    record = await pb.collection('creative_projects').getOne(projectId)
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'creative_projects collection is missing or not provisioned on PocketBase.'
      })
    }
    if (pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: 'Project not found' })
    }
    throw e
  }

  if (pbRecordOwnerId(record as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  return { userId, pb }
}

export function assertRowBelongsToProject (
  row: Record<string, unknown>,
  projectId: string,
  projectIdOnRow: (row: Record<string, unknown>) => string,
  label = 'Record'
): void {
  const rowProjectId = projectIdOnRow(row)
  if (rowProjectId !== projectId) {
    throw createError({ statusCode: 400, message: `${label} does not belong to this project` })
  }
}

export async function requireOwnedProjectRow (
  pb: PocketBase,
  userId: string,
  collection: string,
  rowId: string,
  projectId: string,
  projectIdOnRow: (row: Record<string, unknown>) => string,
  label: string
): Promise<Record<string, unknown>> {
  let row: Record<string, unknown>
  try {
    row = await pb.collection(collection).getOne(rowId) as Record<string, unknown>
  } catch (e: unknown) {
    if (pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: `${label} not found` })
    }
    throw e
  }

  if (pbRecordOwnerId(row as { owner?: unknown; user?: unknown; owned_by?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  assertRowBelongsToProject(row, projectId, projectIdOnRow, label)
  return row
}
