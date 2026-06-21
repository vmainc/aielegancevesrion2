import type PocketBase from 'pocketbase'
import { heuristicCharacterNamesFromScenes } from '~/server/utils/parse-script-txt'
import { filterLikelyCharacterNames } from '~/lib/screenplay-character-filter'
import { executeGenerateShots } from '~/server/utils/execute-generate-shots'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { projectIdOnCharacterRow } from '~/server/utils/creative-character-map'
import { inferCharactersWithScreenShareFromScript } from '~/server/utils/script-import-ai'
import { resolveProjectPreferredOpenRouterModel } from '~/server/utils/project-model-preference'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'

export interface SceneCharacterSuggestion {
  name: string
  roleDescription: string
  screenSharePercent: number | null
}

export interface AnalyzeProjectSceneResult {
  shotCount: number
  shotsPersisted: boolean
  warning: string
  newCharacters: SceneCharacterSuggestion[]
  castInScene: string[]
}

export function normalizeCastName (value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function castNameMatches (name: string, castNormalized: Set<string>): boolean {
  const n = normalizeCastName(name)
  if (!n) return true
  if (castNormalized.has(n)) return true
  for (const c of castNormalized) {
    if (c.length >= 3 && n.length >= 3 && (c.includes(n) || n.includes(c))) {
      return true
    }
  }
  return false
}

async function listProjectCastNames (
  pb: PocketBase,
  projectId: string,
  userId: string
): Promise<string[]> {
  try {
    const rows = await pb.collection('creative_characters').getFullList({
      filter: `project="${projectId}"`,
      batch: 200
    })
    return rows
      .map(r => String((r as { name?: unknown }).name || '').trim())
      .filter(Boolean)
  } catch {
    const rows = await pb.collection('creative_characters').getFullList({
      filter: `owned_by="${userId}"`,
      batch: 400
    })
    return rows
      .filter(r => projectIdOnCharacterRow(r as Record<string, unknown>) === projectId)
      .map(r => String((r as { name?: unknown }).name || '').trim())
      .filter(Boolean)
  }
}

function suggestionsFromHeuristic (
  sceneHeading: string,
  sceneText: string,
  castNormalized: Set<string>
): SceneCharacterSuggestion[] {
  const heuristic = filterLikelyCharacterNames(
    heuristicCharacterNamesFromScenes([{ heading: sceneHeading, body: sceneText }])
  )
  return heuristic
    .filter(name => !castNameMatches(name, castNormalized))
    .map(name => ({ name, roleDescription: '', screenSharePercent: null }))
}

function mergeCharacterSuggestions (
  primary: SceneCharacterSuggestion[],
  fallback: SceneCharacterSuggestion[]
): SceneCharacterSuggestion[] {
  const out: SceneCharacterSuggestion[] = []
  const seen = new Set<string>()
  for (const row of [...primary, ...fallback]) {
    const key = normalizeCastName(row.name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

/**
 * Read scene script, detect cast gaps, and generate storyboard panels for this scene only.
 */
export async function analyzeProjectScene (opts: {
  userId: string
  pb: PocketBase
  projectId: string
  sceneId: string
}): Promise<AnalyzeProjectSceneResult> {
  const { userId, pb, projectId, sceneId } = opts

  const project = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(project as { owner?: unknown; user?: unknown }) !== userId) {
    throwApiError(403, ApiErrorCode.FORBIDDEN, 'Forbidden', { resource: 'project' })
  }

  const scene = await pb.collection('creative_scenes').getOne(sceneId)
  const sceneProject =
    typeof scene.project === 'string'
      ? scene.project
      : ((scene.project as { id?: string } | undefined)?.id || '')
  if (sceneProject !== projectId) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Scene does not belong to this project')
  }

  const heading = String(scene.heading || '').trim()
  const summary = String(scene.summary || '').trim()
  const body = String(scene.body || '').trim()
  const sceneText = body || summary
  if (!sceneText) {
    throwApiError(
      400,
      ApiErrorCode.VALIDATION_ERROR,
      'Add script text for this scene before running the analyser.'
    )
  }

  const castNames = await listProjectCastNames(pb, projectId, userId)
  const castNormalized = new Set(castNames.map(normalizeCastName))

  const projectRec = project as Record<string, unknown>
  const pref = resolveProjectPreferredOpenRouterModel(projectRec)
  const sceneOutline = [heading, body || summary].filter(Boolean).join('\n\n').slice(0, 14000)

  const enrichmentHints = castNames.map(name => ({ name, role_description: '' }))
  const parserCharacterNames = filterLikelyCharacterNames(
    heuristicCharacterNamesFromScenes([{ heading, body: sceneText }])
  )

  let aiCharacters: SceneCharacterSuggestion[] = []
  try {
    const inferred = await inferCharactersWithScreenShareFromScript({
      projectName: String(projectRec.name || 'Project'),
      logline: String(projectRec.synopsis || ''),
      onePageSynopsis: String(projectRec.treatment || projectRec.synopsis || ''),
      genre: String(projectRec.genre || ''),
      tone: String(projectRec.tone || 'cinematic'),
      sceneOutline,
      enrichmentHints,
      parserCharacterNames,
      openrouterModelId: pref.openrouterModelId
    })
    aiCharacters = inferred.map(row => ({
      name: row.name,
      roleDescription: row.role_description || '',
      screenSharePercent:
        typeof row.screen_share_percent === 'number' && Number.isFinite(row.screen_share_percent)
          ? row.screen_share_percent
          : null
    }))
  } catch (e: unknown) {
    console.warn('[analyze-project-scene] character inference failed:', e)
  }

  const castInScene = aiCharacters
    .map(c => c.name)
    .filter(name => castNameMatches(name, castNormalized))

  const newFromAi = aiCharacters.filter(c => !castNameMatches(c.name, castNormalized))
  const newFromHeuristic = suggestionsFromHeuristic(heading, sceneText, castNormalized)
  const newCharacters = mergeCharacterSuggestions(newFromAi, newFromHeuristic)

  const shotResult = await executeGenerateShots({ userId, pb, projectId, sceneId })

  const warnings: string[] = []
  if (shotResult.warning) warnings.push(shotResult.warning)
  if (!shotResult.persisted) {
    warnings.push('Storyboard panels were generated but could not be saved.')
  }

  return {
    shotCount: shotResult.shots.length,
    shotsPersisted: shotResult.persisted,
    warning: warnings.join(' ').trim(),
    newCharacters,
    castInScene: [...new Set(castInScene)]
  }
}
