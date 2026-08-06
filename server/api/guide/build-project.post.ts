import { readBody, setResponseStatus } from 'h3'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'
import { createScriptImportJob } from '~/server/utils/script-import-job-registry'
import { runConceptBootstrapJob } from '~/server/utils/run-concept-bootstrap-job'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError
} from '~/server/utils/pb-missing-collection-error'
import {
  initialConceptNotesForWorkflow,
  legacyPbWorkflowMode,
  normalizeWorkflowMode
} from '~/lib/project-workflow-mode'
import { clampTargetDurationSeconds } from '~/lib/project-duration-budget'
import { upsertDurationMarkerInConceptNotes } from '~/lib/format-stored-concept'
import {
  formatStudioGuideBriefAsConceptNotes,
  parseStudioGuideProjectBrief,
  studioGuideBriefIsReady
} from '~/lib/studio-guide'
import type { ProjectAspectRatio, ProjectGoal, ProjectWorkflowMode } from '~/types/creative-project'

const ASPECT = new Set<ProjectAspectRatio>(['16:9', '9:16', '1:1'])
const GOALS = new Set<ProjectGoal>(['film', 'social', 'commercial', 'other'])
const WORKFLOW = new Set<ProjectWorkflowMode>(['import', 'idea', 'generate'])

/**
 * Studio Guide: create a project from an interviewed brief and start concept bootstrap.
 * Poll GET /api/script-import/jobs/:jobId
 */
export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  checkRateLimit(rateLimitKey(userId, 'studio-guide-build'), 8, 60_000)

  const body = await readBody<{ brief?: unknown }>(event)
  const brief = parseStudioGuideProjectBrief(body?.brief)
  if (!brief || !studioGuideBriefIsReady(brief)) {
    throwApiError(
      400,
      ApiErrorCode.VALIDATION_ERROR,
      'Need a project brief with title, summary (or logline), and target duration in seconds before building.'
    )
  }

  const aspectRatio = ASPECT.has(brief.aspectRatio) ? brief.aspectRatio : '16:9'
  const goal = GOALS.has(brief.goal) ? brief.goal : 'film'
  const workflowMode: ProjectWorkflowMode =
    WORKFLOW.has(brief.workflowMode) && brief.workflowMode !== 'import'
      ? brief.workflowMode
      : 'idea'

  const name = brief.title.slice(0, 500) || 'New project'
  const synopsis = (brief.summary || brief.logline).slice(0, 20_000)
  let conceptNotes = formatStudioGuideBriefAsConceptNotes(brief).slice(0, 50_000)
  const targetDuration = clampTargetDurationSeconds(brief.targetDurationSeconds)
  if (targetDuration != null) {
    conceptNotes = upsertDurationMarkerInConceptNotes(conceptNotes, targetDuration).slice(0, 50_000)
  }

  const pb = await getAuthenticatedPocketBase()
  const conceptNotesSeed = initialConceptNotesForWorkflow(workflowMode)

  const basePayload: Record<string, unknown> = {
    name,
    owned_by: userId,
    aspect_ratio: aspectRatio,
    goal,
    preferred_model_id: 'gpt-4o',
    target_length: 'short',
    synopsis,
    treatment: '',
    concept_notes: conceptNotes || conceptNotesSeed
  }

  const legacyMode = legacyPbWorkflowMode(workflowMode)
  const createAttempts: Array<Record<string, unknown>> = [
    { ...basePayload, workflow_mode: workflowMode },
    ...(legacyMode !== workflowMode ? [{ ...basePayload, workflow_mode: legacyMode }] : []),
    { ...basePayload }
  ]

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
    if (isPocketBaseMissingCollectionError(lastErr)) {
      throwApiError(
        503,
        ApiErrorCode.MISSING_COLLECTION,
        'creative_projects collection is missing in PocketBase.'
      )
    }
    const detail = formatPocketBaseRecordError(lastErr)
    throwApiError(
      500,
      ApiErrorCode.BAD_GATEWAY,
      detail && detail !== 'Failed to create record.' ? detail : 'Could not create project.'
    )
  }

  const enrichPatch: Record<string, unknown> = {}
  if (brief.genre) enrichPatch.genre = brief.genre.slice(0, 200)
  if (brief.tone) enrichPatch.tone = brief.tone.slice(0, 500)
  if (targetDuration != null) enrichPatch.target_duration_seconds = targetDuration
  if (Object.keys(enrichPatch).length) {
    try {
      await pb.collection('creative_projects').update(created.id, enrichPatch)
    } catch {
      /* optional fields may be missing on older schemas */
    }
  }

  const full = await pb.collection('creative_projects').getOne(created.id)
  const project = pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0])
  if (normalizeWorkflowMode(project.workflowMode) !== workflowMode) {
    project.workflowMode = workflowMode
  }

  const jobId = createScriptImportJob(userId)
  void runConceptBootstrapJob({
    jobId,
    userId,
    projectId: created.id,
    title: brief.title,
    logline: brief.logline || brief.summary.split('\n')[0],
    summary: synopsis,
    genre: brief.genre || undefined,
    tone: brief.tone || undefined,
    characters: brief.characters.length ? brief.characters : undefined,
    visualReference: brief.visualStyle || undefined,
    targetDurationSeconds: targetDuration ?? undefined
  })

  setResponseStatus(event, 202)
  return {
    async: true,
    jobId,
    project,
    status: 'running'
  }
})
