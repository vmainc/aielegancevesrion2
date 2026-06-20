import { createError, readBody, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { parseDirectorField, pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { CONCEPT_GENERATOR_MODELS } from '~/lib/concept-generator-models'
import { initialConceptNotesForWorkflow, stripWorkflowMarker } from '~/lib/project-workflow-mode'
import { upsertDurationMarkerInConceptNotes } from '~/lib/format-stored-concept'

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
  const LENGTHS = new Set(['spot', 'short', 'music_video', 'episode', 'feature'])
  const MODEL_IDS = new Set(CONCEPT_GENERATOR_MODELS.map(m => m.id))

  const patch: Record<string, unknown> = {}
  if (typeof body.synopsis === 'string') patch.synopsis = body.synopsis.slice(0, 20000)
  if (typeof body.conceptNotes === 'string') patch.concept_notes = body.conceptNotes.slice(0, 50000)
  if (typeof body.treatment === 'string') patch.treatment = body.treatment.slice(0, 100000)
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 500)
  if (typeof body.aspectRatio === 'string' && ASPECT.has(body.aspectRatio)) {
    patch.aspect_ratio = body.aspectRatio
  }
  if (typeof body.goal === 'string' && GOALS.has(body.goal)) {
    patch.goal = body.goal
  }
  const WORKFLOW = new Set(['import', 'idea', 'generate'])
  if (typeof body.workflowMode === 'string' && WORKFLOW.has(body.workflowMode)) {
    const mode = body.workflowMode as 'import' | 'idea' | 'generate'
    patch.workflow_mode = mode
    const prevNotes = String((existing as { concept_notes?: string }).concept_notes || '')
    const stripped = stripWorkflowMarker(prevNotes)
    patch.concept_notes =
      mode === 'import'
        ? stripped.slice(0, 50_000)
        : `${initialConceptNotesForWorkflow(mode)}${stripped}`.trim().slice(0, 50_000)
  }
  if (typeof body.preferredModelId === 'string' && MODEL_IDS.has(body.preferredModelId)) {
    patch.preferred_model_id = body.preferredModelId
  }
  if (typeof body.targetLength === 'string' && LENGTHS.has(body.targetLength)) {
    patch.target_length = body.targetLength
  }
  if (body.targetDurationSeconds !== undefined) {
    const n = Math.floor(Number(body.targetDurationSeconds))
    const valid = Number.isFinite(n) && n >= 15 && n <= 3600 ? n : null
    patch.target_duration_seconds = valid
    const prevNotes = String((existing as { concept_notes?: string }).concept_notes || '')
    patch.concept_notes = upsertDurationMarkerInConceptNotes(prevNotes, valid).slice(0, 50_000)
  }

  if (body.director === null) {
    // Allow explicit reset from UI.
    patch.director = null
  } else if (body.director !== undefined) {
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
