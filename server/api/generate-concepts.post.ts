import { createError, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { CONCEPT_GENERATOR_MODELS, getConceptGeneratorModelById } from '~/lib/concept-generator-models'
import { generateConceptWithOpenRouter } from '~/server/utils/generate-concept-ai'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'
import type { ConceptGeneratorResultItem } from '~/types/concept-generator'

const GOALS = new Set<ProjectGoal>(['film', 'social', 'commercial', 'other'])
const ASPECTS = new Set<ProjectAspectRatio>(['16:9', '9:16', '1:1'])

function projectGoalFromRecord (row: Record<string, unknown>): ProjectGoal {
  const g = String(row.goal || 'film')
  return GOALS.has(g as ProjectGoal) ? (g as ProjectGoal) : 'film'
}

function projectAspectFromRecord (row: Record<string, unknown>): ProjectAspectRatio {
  const a = String(row.aspect_ratio || '16:9')
  return ASPECTS.has(a as ProjectAspectRatio) ? (a as ProjectAspectRatio) : '16:9'
}

const PB_ID = /^[a-z0-9]{15}$/

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)

  const body = await readBody(event).catch(() => null) as {
    project_id?: string
    user_prompt?: string
    selected_models?: string[]
    goal?: string
    aspect_ratio?: string
  } | null

  const projectId = typeof body?.project_id === 'string' ? body.project_id.trim() : ''
  const userPrompt = typeof body?.user_prompt === 'string' ? body.user_prompt.trim() : ''
  const selectedRaw = Array.isArray(body?.selected_models) ? body!.selected_models! : []

  if (!projectId) {
    throw createError({ statusCode: 400, message: 'project_id is required' })
  }
  if (!userPrompt) {
    throw createError({ statusCode: 400, message: 'user_prompt is required' })
  }

  const selectedIds = [...new Set(selectedRaw.map(x => String(x).trim()).filter(Boolean))]
  if (selectedIds.length === 0) {
    throw createError({ statusCode: 400, message: 'selected_models must include at least one model id' })
  }

  const unknown = selectedIds.filter(id => !getConceptGeneratorModelById(id))
  if (unknown.length) {
    throw createError({
      statusCode: 400,
      message: `Unknown model id(s): ${unknown.join(', ')}`
    })
  }

  let projectGoal: ProjectGoal = 'film'
  let projectAspect: ProjectAspectRatio = '16:9'
  if (typeof body?.goal === 'string' && GOALS.has(body.goal as ProjectGoal)) {
    projectGoal = body.goal as ProjectGoal
  }
  if (typeof body?.aspect_ratio === 'string' && ASPECTS.has(body.aspect_ratio as ProjectAspectRatio)) {
    projectAspect = body.aspect_ratio as ProjectAspectRatio
  }

  if (PB_ID.test(projectId)) {
    const pb = await getAuthenticatedPocketBase()
    try {
      const project = await pb.collection('creative_projects').getOne(projectId)
      const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
      if (owner !== userId) {
        throw createError({ statusCode: 403, message: 'Forbidden' })
      }
      projectGoal = projectGoalFromRecord(project as Record<string, unknown>)
      projectAspect = projectAspectFromRecord(project as Record<string, unknown>)
    } catch (e: unknown) {
      const err = e as { statusCode?: number; status?: number; response?: { status?: number } }
      if (err?.statusCode === 403 || err?.status === 403) throw e
      if (err?.statusCode === 404 || err?.status === 404 || err?.response?.status === 404) {
        throw createError({ statusCode: 404, message: 'Project not found' })
      }
      throw e
    }
  }

  const tasks = selectedIds.map(async (modelId): Promise<ConceptGeneratorResultItem> => {
    const cfg = CONCEPT_GENERATOR_MODELS.find(m => m.id === modelId)
    if (!cfg) {
      return { model: modelId, error: 'Unknown model' }
    }
    try {
      const parsed = await generateConceptWithOpenRouter({
        openrouterModelId: cfg.openrouterModelId,
        userPrompt,
        goal: projectGoal,
        aspectRatio: projectAspect
      })
      return {
        model: cfg.id,
        title: parsed.title,
        logline: parsed.logline,
        summary: parsed.summary,
        tone: parsed.tone,
        genre: parsed.genre,
        ...(parsed.hook ? { hook: parsed.hook } : {})
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed'
      return { model: cfg.id, error: msg }
    }
  })

  const results = await Promise.all(tasks)
  /** STEP 5: bare array of per-model results (success objects or `{ model, error }`). */
  return results
})
