import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwnerOnly } from '~/server/utils/bible-project-access'
import { pbRecordToProjectMember } from '~/server/utils/project-member-map'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { formatPocketBaseRecordError, isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const body = await readBody<{ email?: string }>(event)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, message: 'A valid email address is required.' })
  }

  const { userId, pb } = await requireProjectOwnerOnly(event, projectId)

  let targetUser: Record<string, unknown>
  try {
    targetUser = await pb.collection('users').getFirstListItem(
      `email = "${email.replace(/"/g, '\\"')}"`
    ) as Record<string, unknown>
  } catch {
    throw createError({
      statusCode: 404,
      message: 'No account found with that email. They need to sign up first.'
    })
  }

  const targetUserId = String(targetUser.id || '')
  if (!targetUserId) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }
  if (targetUserId === userId) {
    throw createError({ statusCode: 400, message: 'You already own this project.' })
  }

  const project = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(project) === targetUserId) {
    throw createError({ statusCode: 400, message: 'That user already owns this project.' })
  }

  try {
    const existing = await pb.collection('project_members').getFullList({
      filter: `project = "${projectId}" && user = "${targetUserId}"`,
      batch: 5
    })
    if (existing.length > 0) {
      throw createError({ statusCode: 409, message: 'That user is already a member of this project.' })
    }
  } catch (e: unknown) {
    if (!isPocketBaseMissingCollectionError(e) && (e as { statusCode?: number }).statusCode !== 409) {
      throw e
    }
    if ((e as { statusCode?: number }).statusCode === 409) throw e
  }

  try {
    const created = await pb.collection('project_members').create({
      project: projectId,
      user: targetUserId,
      role: 'member',
      invited_by: userId
    })
    const expanded = await pb.collection('project_members').getOne(created.id, { expand: 'user' })
    return {
      member: pbRecordToProjectMember(expanded as Record<string, unknown>)
    }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'project_members collection is missing. Run: node scripts/setup-collections.js'
      })
    }
    const detail = formatPocketBaseRecordError(e)
    throw createError({
      statusCode: 400,
      message: detail && detail !== 'Failed to create record.' ? detail : 'Could not add member.'
    })
  }
})
