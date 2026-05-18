import type PocketBase from 'pocketbase'
import {
  fitShotsToSceneCap,
  perSceneShotCap,
  resolveProjectDurationBudget
} from '~/lib/project-duration-budget'
import { parseDurationFromConceptNotes } from '~/lib/format-stored-concept'
import { parseDirectorField } from '~/server/utils/creative-project-map'
import { generateShotsWithAi } from '~/server/utils/generate-shots-ai'
import { replaceSceneShots } from '~/server/utils/persist-scene-shots'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

/** Limit import-time storyboard generation to control cost and wall time. */
export const IMPORT_STORYBOARD_MAX_SCENES = 28
const CONCURRENCY = 2

export interface StoryboardSeedScene {
  id: string
  heading: string
  summary: string
  body: string
}

export interface StoryboardSeedCharacter {
  name: string
  role_description: string
}

export interface StoryboardSeedResult {
  ok: number
  failed: number
  capSkipped: number
  emptySkipped: number
}

/**
 * After script import: generate Claude storyboard panels (creative_shots) per scene.
 * Skips continuity pass (import speed); user can regenerate a scene from the Storyboard tab for full continuity.
 */
export async function seedStoryboardsAfterScriptImport (params: {
  pb: PocketBase
  userId: string
  projectId: string
  project: Record<string, unknown>
  scenes: StoryboardSeedScene[]
  characters: StoryboardSeedCharacter[]
}): Promise<StoryboardSeedResult> {
  const config = useRuntimeConfig()
  if (!resolveOpenRouterApiKey(config)) {
    return {
      ok: 0,
      failed: 0,
      capSkipped: Math.max(0, params.scenes.length - IMPORT_STORYBOARD_MAX_SCENES),
      emptySkipped: 0
    }
  }

  const { pb, userId, projectId, project, scenes, characters } = params
  const budget = resolveProjectDurationBudget({
    targetDurationSeconds:
      typeof project.target_duration_seconds === 'number' && project.target_duration_seconds > 0
        ? project.target_duration_seconds
        : parseDurationFromConceptNotes(String(project.concept_notes || '')),
    targetLength: project.target_length as import('~/types/creative-project').ProjectTargetLength | undefined,
    goal: String(project.goal || 'film') as import('~/types/creative-project').ProjectGoal
  })
  const sceneCap = budget
    ? Math.min(IMPORT_STORYBOARD_MAX_SCENES, budget.maxScenesForImport)
    : IMPORT_STORYBOARD_MAX_SCENES
  const capSkipped = Math.max(0, scenes.length - sceneCap)
  const toProcess = scenes.slice(0, sceneCap)

  const director = parseDirectorField(project.director) ?? null
  const continuityMemory = String(project.continuity_memory || '')
  const charCtx = characters.map(c => ({
    name: c.name,
    traitsRoleVisual: String(c.role_description || '')
  }))

  let panelsUsed = 0

  async function seedOne (
    scene: StoryboardSeedScene,
    sceneIndex: number
  ): Promise<'ok' | 'fail' | 'empty'> {
    const body = (scene.body || '').trim()
    const summary = (scene.summary || '').trim()
    if (!body && !summary) return 'empty'
    if (budget && panelsUsed >= budget.maxPanelsTotal) return 'empty'
    try {
      const sceneCap = budget
        ? perSceneShotCap(budget, toProcess.length, sceneIndex)
        : null
      const remaining = budget ? budget.maxPanelsTotal - panelsUsed : sceneCap?.maxShots ?? 12
      const maxShots = sceneCap
        ? Math.min(sceneCap.maxShots, Math.max(1, remaining))
        : 12
      const sceneShotCap = sceneCap
        ? { minShots: Math.min(sceneCap.minShots, maxShots), maxShots }
        : null
      const shots = await generateShotsWithAi({
        projectName: String(project.name || 'Project'),
        aspectRatio: String(project.aspect_ratio || '16:9'),
        goal: String(project.goal || 'film'),
        tone: String(project.tone || 'cinematic'),
        sceneTitle: scene.heading || 'Scene',
        sceneSummary: summary,
        sceneScript: body,
        characters: charCtx,
        director,
        continuityMemory,
        durationBudget: budget,
        sceneShotCap
      })
      const fitted = budget
        ? fitShotsToSceneCap(shots, maxShots, budget.clipSeconds)
        : shots
      panelsUsed += fitted.length
      await replaceSceneShots(pb, userId, projectId, scene.id, fitted)
      return 'ok'
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[import-storyboard-seed] scene', scene.id, msg)
      return 'fail'
    }
  }

  let ok = 0
  let failed = 0
  let emptySkipped = 0

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map((s, j) => seedOne(s, i + j))
    )
    for (const r of results) {
      if (r === 'ok') ok++
      else if (r === 'empty') emptySkipped++
      else failed++
    }
  }

  return { ok, failed, capSkipped, emptySkipped }
}
