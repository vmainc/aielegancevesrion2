import { createError, readBody, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { parseDirectorField, pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody<Record<string, unknown>>(event)
  const pb = await getAuthenticatedPocketBase()

  const existing = await pb.collection('creative_projects').getOne(id)
  const owner = pbRecordOwnerId(existing as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const ASPECT = new Set(['16:9', '9:16', '1:1'])
  const GOALS = new Set(['film', 'social', 'commercial', 'other'])
  const LENGTHS = new Set(['spot', 'short', 'episode', 'feature'])

  const patch: Record<string, unknown> = {}
  if (typeof body.synopsis === 'string') patch.synopsis = body.synopsis
  if (typeof body.conceptNotes === 'string') patch.concept_notes = body.conceptNotes
  if (typeof body.treatment === 'string') patch.treatment = body.treatment
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.aspectRatio === 'string' && ASPECT.has(body.aspectRatio)) {
    patch.aspect_ratio = body.aspectRatio
  }
  if (typeof body.goal === 'string' && GOALS.has(body.goal)) {
    patch.goal = body.goal
  }
  if (typeof body.targetLength === 'string' && LENGTHS.has(body.targetLength)) {
    patch.target_length = body.targetLength
  }

  if (body.director !== undefined && body.director !== null) {
    const d = parseDirectorField(body.director)
    if (d) patch.director = d
  }
  if (typeof body.continuityMemory === 'string') {
    patch.continuity_memory = body.continuityMemory.slice(0, 50000)
  }
  if (typeof body.continuityLastIssues === 'string') {
    patch.continuity_last_issues = body.continuityLastIssues.slice(0, 20000)
  }
  if (typeof body.genre === 'string') {
    patch.genre = body.genre.slice(0, 200)
  }
  if (typeof body.tone === 'string') {
    patch.tone = body.tone.slice(0, 500)
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  const updated = await pb.collection('creative_projects').update(id, patch)
  return {
    project: pbRecordToCreativeProject(updated as Parameters<typeof pbRecordToCreativeProject>[0])
  }
})
