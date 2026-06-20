import { createError, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  initialConceptNotesForWorkflow,
  legacyPbWorkflowMode,
  normalizeWorkflowMode
} from '~/lib/project-workflow-mode'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError
} from '~/server/utils/pb-missing-collection-error'
import type { ProjectAspectRatio, ProjectGoal, ProjectWorkflowMode } from '~/types/creative-project'

const ASPECT = new Set<ProjectAspectRatio>(['16:9', '9:16', '1:1'])
const GOALS = new Set<ProjectGoal>(['film', 'social', 'commercial', 'other'])
const WORKFLOW = new Set<ProjectWorkflowMode>(['import', 'idea', 'generate'])

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody<{
    name?: string
    aspectRatio?: string
    goal?: string
    workflowMode?: string
  }>(event)

  const nameRaw = typeof body?.name === 'string' ? body.name.trim() : ''
  const name = nameRaw.slice(0, 500) || 'New project'

  const aspectRatio =
    typeof body?.aspectRatio === 'string' && ASPECT.has(body.aspectRatio as ProjectAspectRatio)
      ? (body.aspectRatio as ProjectAspectRatio)
      : '16:9'

  const goal =
    typeof body?.goal === 'string' && GOALS.has(body.goal as ProjectGoal)
      ? (body.goal as ProjectGoal)
      : 'film'

  const workflowMode =
    typeof body?.workflowMode === 'string' && WORKFLOW.has(body.workflowMode as ProjectWorkflowMode)
      ? (body.workflowMode as ProjectWorkflowMode)
      : 'import'

  const pb = await getAuthenticatedPocketBase()
  const conceptNotesSeed = initialConceptNotesForWorkflow(workflowMode)

  const basePayload = {
    name,
    owned_by: userId,
    aspect_ratio: aspectRatio,
    goal,
    preferred_model_id: 'claude',
    target_length: 'short',
    synopsis: '',
    treatment: '',
    concept_notes: conceptNotesSeed
  }

  const legacyMode = legacyPbWorkflowMode(workflowMode)
  const createAttempts: Array<Record<string, unknown>> = [
    { ...basePayload, workflow_mode: workflowMode },
    ...(legacyMode !== workflowMode ? [{ ...basePayload, workflow_mode: legacyMode }] : []),
    { ...basePayload }
  ]

  try {
    let created: { id: string } | null = null
    let lastErr: unknown = null
    for (const payload of createAttempts) {
      try {
        created = await pb.collection('creative_projects').create(payload)
        break
      } catch (e: unknown) {
        lastErr = e
      }
    }
    if (!created) {
      throw lastErr ?? new Error('Could not create project.')
    }

    const full = await pb.collection('creative_projects').getOne(created.id)
    const project = pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0])
    if (normalizeWorkflowMode(project.workflowMode) !== workflowMode) {
      project.workflowMode = workflowMode
    }
    return { project }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message:
          'creative_projects collection is missing in PocketBase. From your machine run: npm run setup-db (or node scripts/setup-collections.js) with POCKETBASE_URL pointing at this environment’s PocketBase API (e.g. https://yourdomain.com/pb) and superuser credentials in POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD.'
      })
    }
    const detail = formatPocketBaseRecordError(e)
    throw createError({
      statusCode: 500,
      message: detail && detail !== 'Failed to create record.' ? detail : 'Could not create project.'
    })
  }
})
