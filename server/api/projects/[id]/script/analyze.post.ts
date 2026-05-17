import { getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  analyzeScriptImportForProject,
  loadWorkflowScreenplayParsedForProject,
  runDirectorOnlyFromParsed
} from '~/server/utils/import-script-core'
import {
  enrichScriptWithAi,
  enrichmentToProjectFields,
  scriptPreviewEnrichmentIsUsable
} from '~/server/utils/script-import-ai'
import { filterLikelyCharacterNames, heuristicCharacterNamesFromScenes } from '~/server/utils/parse-script-txt'
import { getConceptGeneratorModelById } from '~/lib/concept-generator-models'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'
import {
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'

function candidateModelSlugsFor (modelId: string, primary: string): string[] {
  if (modelId === 'claude') {
    // Omit Haiku here: large JSON enrichment is unreliable; Sonnet variants are the practical fallbacks.
    return [...new Set([
      primary,
      'anthropic/claude-sonnet-4',
      'anthropic/claude-3.7-sonnet',
      'anthropic/claude-3.5-sonnet'
    ])].filter(Boolean)
  }
  if (modelId === 'deepseek') {
    return [...new Set([
      primary,
      'deepseek/deepseek-chat-v3-0324',
      'deepseek/deepseek-chat',
      'deepseek/deepseek-v3'
    ])].filter(Boolean)
  }
  return [primary]
}

function sceneOutlineForPreview (scenes: Array<{ heading: string; body: string }>): string {
  // Mirror director analyze behavior: single FULL SCRIPT fallback needs more context.
  const perSceneLimit = scenes.length <= 1 ? 20000 : 2500
  return scenes
    .map((s, i) => `## Scene ${i + 1}\nHeading: ${s.heading}\n---\n${s.body.slice(0, perSceneLimit)}`)
    .join('\n\n')
}

/**
 * Director pass: synopsis, treatment, three-act notes, director bible — from the saved screenplay asset.
 * Scenes, cast, and storyboard are generated from the Characters / Scenes / Storyboard tabs.
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Missing project id')
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const body = await readBody<{
    assetId?: string
    selectedModels?: string[]
    chosenModelId?: string
    mode?: 'preview' | 'apply'
  }>(event).catch(() => ({} as {
    assetId?: string
    selectedModels?: string[]
    chosenModelId?: string
    mode?: 'preview' | 'apply'
  }))
  const raw = body && typeof body.assetId === 'string' ? body.assetId.trim() : ''
  const assetId = raw || undefined

  const selectedModels = Array.isArray(body?.selectedModels)
    ? [...new Set(body!.selectedModels.map(m => String(m).trim()).filter(Boolean))]
    : []
  const previewMode = body?.mode === 'preview'
  const chosenModelId = typeof body?.chosenModelId === 'string' ? body.chosenModelId.trim() : ''

  if (previewMode && selectedModels.length) {
    let projectRow: unknown
    try {
      projectRow = await pb.collection('creative_projects').getOne(projectId)
    } catch (e: unknown) {
      if (isPocketBaseMissingCollectionError(e)) {
        throwApiError(
          503,
          ApiErrorCode.MISSING_COLLECTION,
          'PocketBase creative_projects collection is missing or not provisioned. Run npm run setup-db against this environment.',
          { collection: 'creative_projects' }
        )
      }
      if (pocketBaseErrorStatus(e) === 404) {
        throwApiError(404, ApiErrorCode.PROJECT_NOT_FOUND, 'Project not found.', { projectId })
      }
      throw e
    }
    if (pbRecordOwnerId(projectRow as { owner?: unknown; user?: unknown }) !== userId) {
      throwApiError(403, ApiErrorCode.FORBIDDEN, 'Forbidden', { resource: 'project' })
    }
    const { parsed } = await loadWorkflowScreenplayParsedForProject({
      userId,
      pb,
      projectId,
      assetId
    })
    const sceneOutline = sceneOutlineForPreview(parsed.scenes)
    const mergedCharacterNames = filterLikelyCharacterNames([
      ...parsed.characterNames,
      ...heuristicCharacterNamesFromScenes(parsed.scenes)
    ])
    const projectName = String((projectRow as { name?: unknown }).name || 'Project')

    const candidates = await Promise.all(
      selectedModels.map(async (id) => {
        const cfg = getConceptGeneratorModelById(id)
        if (!cfg) return null
        const slugs = candidateModelSlugsFor(cfg.id, cfg.openrouterModelId)
        let lastError = 'No usable output from model.'
        for (const slug of slugs) {
          try {
            const enrichment = await enrichScriptWithAi({
              projectName,
              sceneOutline,
              characterNames: mergedCharacterNames,
              openrouterModelId: slug
            })
            const prose = enrichmentToProjectFields(enrichment)
            const candidate = {
              modelId: cfg.id,
              label: cfg.label,
              synopsis: prose.synopsis.slice(0, 20000),
              treatment: prose.treatment.slice(0, 50000),
              genre: enrichment.genre,
              tone: enrichment.tone
            }
            if (scriptPreviewEnrichmentIsUsable(enrichment, prose)) {
              return candidate
            }
            lastError = `Model returned unusable or stub output (${slug}).`
          } catch (e: unknown) {
            lastError = e instanceof Error ? e.message : String(e)
          }
        }
        return {
          modelId: cfg.id,
          label: cfg.label,
          error: lastError
        }
      })
    )
    return {
      candidates: candidates.filter(Boolean),
      assetId
    }
  }

  if (chosenModelId) {
    const cfg = getConceptGeneratorModelById(chosenModelId)
    if (!cfg) {
      throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Unknown model choice', { chosenModelId })
    }
    const { parsed, filename, assetId: resolvedAssetId } = await loadWorkflowScreenplayParsedForProject({
      userId,
      pb,
      projectId,
      assetId
    })
    return runDirectorOnlyFromParsed({
      userId,
      pb,
      filename,
      parsed,
      existingProjectId: projectId,
      reuseAssetId: resolvedAssetId,
      openrouterModelId: cfg.openrouterModelId,
      preferredModelId: cfg.id
    })
  }

  return analyzeScriptImportForProject({
    userId,
    pb,
    projectId,
    assetId
  })
})
