import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

const HEADING_MAX = 2000
const SUMMARY_MAX = 5000
const BODY_MAX = 150_000

function relProjectId (v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && 'id' in v) return String((v as { id: string }).id)
  return ''
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  if (!projectId || !sceneId) {
    throw createError({ statusCode: 400, message: 'Missing project or scene id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(project as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const existing = await pb.collection('creative_scenes').getOne(sceneId)
  if (pbRecordOwnerId(existing as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const sid = relProjectId(existing.project)
  if (sid !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }

  const body = await readBody<{
    heading?: string
    summary?: string
    body?: string
  }>(event).catch(() => ({}))

  const patch: Record<string, unknown> = {}

  if (body && typeof body.heading === 'string') {
    const heading = body.heading.trim().slice(0, HEADING_MAX)
    if (!heading) {
      throw createError({ statusCode: 400, message: 'Heading cannot be empty' })
    }
    patch.heading = heading
  }

  if (body && typeof body.summary === 'string') {
    patch.summary = body.summary.trim().slice(0, SUMMARY_MAX)
  }

  if (body && typeof body.body === 'string') {
    patch.body = body.body.trim().slice(0, BODY_MAX)
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  try {
    const updated = await pb.collection('creative_scenes').update(sceneId, patch)
    const bodyText = String(updated.body || '')
    return {
      scene: {
        id: updated.id,
        sortOrder: typeof updated.sort_order === 'number' ? updated.sort_order : 0,
        heading: String(updated.heading || ''),
        summary: String(updated.summary || ''),
        body: bodyText,
        bodyLength: bodyText.length
      }
    }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not update scene'
    })
  }
})
