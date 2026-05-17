import type PocketBase from 'pocketbase'
import {
  conceptNotesHaveUserContent,
  parseCharactersFromConceptNotes,
  parseDurationFromConceptNotes,
  parseLoglineFromConceptNotes,
  stripConceptMetadataMarkers
} from '~/lib/format-stored-concept'
import { resolveProjectDurationBudget } from '~/lib/project-duration-budget'
import { sanitizeCharacterNameList } from '~/lib/screenplay-format'
import { generateScreenplayFromStoryIdea } from '~/server/utils/generate-screenplay-from-idea'
import {
  parseScriptBufferToParsed,
  runFullImportFromParsed,
  type AspectRatio,
  type ProjectGoal as ImportGoal
} from '~/server/utils/import-script-core'
import type { StoryboardSeedResult } from '~/server/utils/import-storyboard-seed'
import type { CreativeProject } from '~/types/creative-project'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'
import {
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'

export interface BootstrapFromConceptInput {
  userId: string
  pb: PocketBase
  projectId: string
  title?: string
  logline?: string
  summary?: string
  genre?: string
  tone?: string
  characters?: string[]
}

export interface BootstrapFromConceptResult {
  project: CreativeProject
  storyboard: StoryboardSeedResult
  sceneCount: number
}

function mapGoal (raw: string): ImportGoal {
  if (raw === 'social' || raw === 'commercial' || raw === 'other') return raw
  return 'film'
}

function mapAspect (raw: string): AspectRatio {
  if (raw === '9:16' || raw === '1:1') return raw
  return '16:9'
}

/**
 * Scratch workflow: turn a saved concept into screenplay + director + cast + scenes + storyboard shot lists.
 */
export async function bootstrapProjectFromConcept (
  input: BootstrapFromConceptInput
): Promise<BootstrapFromConceptResult> {
  const { userId, pb, projectId } = input

  let projectRow: Record<string, unknown>
  try {
    projectRow = await pb.collection('creative_projects').getOne(projectId) as Record<string, unknown>
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throwApiError(503, ApiErrorCode.MISSING_COLLECTION, 'creative_projects is not provisioned.')
    }
    if (pocketBaseErrorStatus(e) === 404) {
      throwApiError(404, ApiErrorCode.PROJECT_NOT_FOUND, 'Project not found.', { projectId })
    }
    throw e
  }

  if (pbRecordOwnerId(projectRow) !== userId) {
    throwApiError(403, ApiErrorCode.FORBIDDEN, 'Forbidden', { resource: 'project' })
  }

  const conceptNotes = String(projectRow.concept_notes || '')
  const title = (input.title || String(projectRow.name || '')).trim().slice(0, 500)
  let summary = (input.summary || String(projectRow.synopsis || '')).trim()
  if (!summary) {
    const logline = parseLoglineFromConceptNotes(conceptNotes)
    if (logline) summary = logline
  }
  if (!summary && conceptNotesHaveUserContent(conceptNotes)) {
    summary = stripConceptMetadataMarkers(conceptNotes).slice(0, 20_000)
  }
  if (!title || !summary) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Project needs a title and synopsis before building.')
  }

  const logline =
    (input.logline || parseLoglineFromConceptNotes(conceptNotes) || summary.split('\n')[0] || '').trim()
  const genre = (input.genre || String(projectRow.genre || '')).trim()
  const tone = (input.tone || String(projectRow.tone || '')).trim()
  const goal = mapGoal(String(projectRow.goal || 'film'))
  const aspectRatio = mapAspect(String(projectRow.aspect_ratio || '16:9'))

  const conceptChars = sanitizeCharacterNameList([
    ...(input.characters || []),
    ...parseCharactersFromConceptNotes(conceptNotes)
  ])

  const durationBudget = resolveProjectDurationBudget({
    targetDurationSeconds:
      typeof projectRow.target_duration_seconds === 'number' && projectRow.target_duration_seconds > 0
        ? projectRow.target_duration_seconds
        : parseDurationFromConceptNotes(conceptNotes),
    targetLength: projectRow.target_length as import('~/types/creative-project').ProjectTargetLength | undefined,
    goal
  })

  const scriptText = await generateScreenplayFromStoryIdea({
    title,
    logline,
    summary,
    genre,
    tone,
    characters: conceptChars,
    goal,
    durationBudget
  })

  const filename = 'ai-story-idea.txt'
  const fileBuf = Buffer.from(scriptText, 'utf8')
  const parsed = await parseScriptBufferToParsed(fileBuf, filename)

  const { project, storyboardSeed, sceneCount } = await runFullImportFromParsed({
    userId,
    pb,
    fileBuf,
    filename,
    parsed,
    aspectRatio,
    goal,
    existingProjectId: projectId,
    reuseAssetId: null,
    conceptCharacterNames: conceptChars
  })

  return {
    project,
    storyboard: storyboardSeed,
    sceneCount
  }
}
