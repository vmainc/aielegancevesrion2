import { createError, type H3Event } from 'h3'
import type PocketBase from 'pocketbase'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import {
  assertUserHasProjectAccess,
  loadProjectRecordOrThrow,
  requireProjectAccess,
  type ProjectAccess
} from '~/server/utils/project-access'

export function bibleRelId (v: string | { id?: string } | undefined): string {
  if (!v) return ''
  return typeof v === 'string' ? v : (v.id || '')
}

/** Project owner or shared member — read/write project content. */
export async function requireProjectOwner (
  event: H3Event,
  projectId: string
): Promise<{ userId: string; pb: PocketBase; access: ProjectAccess }> {
  const { userId, pb, access } = await requireProjectAccess(event, projectId)
  return { userId, pb, access }
}

/** Only the project owner — sharing settings, delete project, etc. */
export async function requireProjectOwnerOnly (
  event: H3Event,
  projectId: string
): Promise<{ userId: string; pb: PocketBase; access: ProjectAccess }> {
  const { userId, pb, access } = await requireProjectAccess(event, projectId, { requireOwner: true })
  return { userId, pb, access }
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
  await assertUserHasProjectAccess(pb, userId, projectId)

  let row: Record<string, unknown>
  try {
    row = await pb.collection(collection).getOne(rowId) as Record<string, unknown>
  } catch (e: unknown) {
    if (pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: `${label} not found` })
    }
    throw e
  }

  assertRowBelongsToProject(row, projectId, projectIdOnRow, label)
  return row
}

export async function loadProjectForAccessCheck (
  event: H3Event,
  projectId: string
): Promise<{ userId: string; pb: PocketBase; project: Record<string, unknown> }> {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()
  const project = await loadProjectRecordOrThrow(pb, projectId)
  await assertUserHasProjectAccess(pb, userId, projectId)
  return { userId, pb, project }
}
