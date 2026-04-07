import type PocketBase from 'pocketbase'
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
  const capSkipped = Math.max(0, scenes.length - IMPORT_STORYBOARD_MAX_SCENES)
  const toProcess = scenes.slice(0, IMPORT_STORYBOARD_MAX_SCENES)

  const director = parseDirectorField(project.director) ?? null
  const continuityMemory = String(project.continuity_memory || '')
  const charCtx = characters.map(c => ({
    name: c.name,
    traitsRoleVisual: String(c.role_description || '')
  }))

  async function seedOne (scene: StoryboardSeedScene): Promise<'ok' | 'fail' | 'empty'> {
    const body = (scene.body || '').trim()
    const summary = (scene.summary || '').trim()
    if (!body && !summary) return 'empty'
    try {
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
        continuityMemory
      })
      await replaceSceneShots(pb, userId, projectId, scene.id, shots)
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
    const results = await Promise.all(batch.map(s => seedOne(s)))
    for (const r of results) {
      if (r === 'ok') ok++
      else if (r === 'empty') emptySkipped++
      else failed++
    }
  }

  return { ok, failed, capSkipped, emptySkipped }
}
