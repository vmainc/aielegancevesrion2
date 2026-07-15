import { createError, type H3Event } from 'h3'
import type PocketBase from 'pocketbase'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import type { ProjectAccessRole } from '~/types/project-member'

export type ProjectAccess = {
  role: ProjectAccessRole
  ownerId: string
}

function userIdOnMemberRow (row: Record<string, unknown>): string {
  const raw = row.user
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'id' in raw) {
    return String((raw as { id?: string }).id || '')
  }
  return ''
}

function projectIdOnMemberRow (row: Record<string, unknown>): string {
  const raw = row.project
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'id' in raw) {
    return String((raw as { id?: string }).id || '')
  }
  return ''
}

export async function loadProjectMemberRole (
  pb: PocketBase,
  projectId: string,
  userId: string
): Promise<'member' | null> {
  if (!projectId || !userId) return null
  try {
    const rows = await pb.collection('project_members').getFullList({
      filter: `project = "${projectId}" && user = "${userId}"`,
      batch: 5
    })
    const hit = rows[0] as Record<string, unknown> | undefined
    if (!hit) return null
    if (projectIdOnMemberRow(hit) !== projectId) return null
    if (userIdOnMemberRow(hit) !== userId) return null
    return 'member'
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) return null
    if (pocketBaseErrorStatus(e) === 404) return null
    throw e
  }
}

export async function resolveProjectAccess (
  pb: PocketBase,
  userId: string,
  projectId: string,
  projectRecord?: Record<string, unknown>
): Promise<ProjectAccess | null> {
  if (!projectId || !userId) return null

  let project = projectRecord
  if (!project) {
    try {
      project = await pb.collection('creative_projects').getOne(projectId) as Record<string, unknown>
    } catch (e: unknown) {
      if (pocketBaseErrorStatus(e) === 404) return null
      throw e
    }
  }

  const ownerId = pbRecordOwnerId(project)
  if (!ownerId) return null
  if (ownerId === userId) {
    return { role: 'owner', ownerId }
  }

  const memberRole = await loadProjectMemberRole(pb, projectId, userId)
  if (memberRole) {
    return { role: memberRole, ownerId }
  }

  return null
}

export async function listSharedProjectIdsForUser (
  pb: PocketBase,
  userId: string
): Promise<string[]> {
  if (!userId) return []
  try {
    const rows = await pb.collection('project_members').getFullList({
      filter: `user = "${userId}"`,
      batch: 500
    })
    const ids = new Set<string>()
    for (const row of rows as Array<Record<string, unknown>>) {
      const pid = projectIdOnMemberRow(row)
      if (pid) ids.add(pid)
    }
    return [...ids]
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) return []
    throw e
  }
}

export async function listAccessibleProjectIds (
  pb: PocketBase,
  userId: string
): Promise<string[]> {
  const owned = await pb.collection('creative_projects').getFullList({
    filter: `owned_by = "${userId}"`,
    batch: 500
  }).catch(() => [])
  const ids = new Set<string>(owned.map(r => String((r as { id?: string }).id || '')).filter(Boolean))
  for (const pid of await listSharedProjectIdsForUser(pb, userId)) {
    ids.add(pid)
  }
  return [...ids]
}

export async function assertUserHasProjectAccess (
  pb: PocketBase,
  userId: string,
  projectId: string,
  options?: { requireOwner?: boolean }
): Promise<ProjectAccess> {
  const access = await resolveProjectAccess(pb, userId, projectId)
  if (!access) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  if (options?.requireOwner && access.role !== 'owner') {
    throw createError({ statusCode: 403, message: 'Only the project owner can do this.' })
  }
  return access
}

export async function requireProjectAccess (
  event: H3Event,
  projectId: string,
  options?: { requireOwner?: boolean }
): Promise<{ userId: string; pb: PocketBase; access: ProjectAccess }> {
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()
  const access = await assertUserHasProjectAccess(pb, userId, projectId, options)
  return { userId, pb, access }
}

export async function loadProjectRecordOrThrow (
  pb: PocketBase,
  projectId: string
): Promise<Record<string, unknown>> {
  try {
    return await pb.collection('creative_projects').getOne(projectId) as Record<string, unknown>
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
}
