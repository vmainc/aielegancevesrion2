import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
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
import { candidateOpenRouterSlugsFor, getConceptGeneratorModelById } from '~/lib/concept-generator-models'
import {
  completeScriptAnalyzeApplyJob,
  completeScriptAnalyzePreviewJob,
  failScriptAnalyzeJob,
  type ScriptAnalyzeCandidate
} from '~/server/utils/script-analyze-job-registry'

function sceneOutlineForPreview (scenes: Array<{ heading: string; body: string }>): string {
  const perSceneLimit = scenes.length <= 1 ? 20000 : 2500
  return scenes
    .map((s, i) => `## Scene ${i + 1}\nHeading: ${s.heading}\n---\n${s.body.slice(0, perSceneLimit)}`)
    .join('\n\n')
}

/** Async preview: run selected models in parallel and store candidate prose. */
export async function runScriptAnalyzePreviewJob (input: {
  jobId: string
  userId: string
  projectId: string
  assetId?: string
  selectedModels: string[]
}): Promise<void> {
  const { jobId, userId, projectId, assetId, selectedModels } = input
  try {
    const pb = await getAuthenticatedPocketBase()
    const projectRow = await pb.collection('creative_projects').getOne(projectId)
    const projectName = String((projectRow as { name?: unknown }).name || 'Project')

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

    const candidates = await Promise.all(
      selectedModels.map(async (id): Promise<ScriptAnalyzeCandidate | null> => {
        const cfg = getConceptGeneratorModelById(id)
        if (!cfg) return null
        const slugs = candidateOpenRouterSlugsFor(cfg.id, cfg.openrouterModelId)
        let lastError = 'No usable output from model.'
        for (const slug of slugs) {
          try {
            const enrichment = await enrichScriptWithAi({
              projectName,
              sceneOutline,
              characterNames: mergedCharacterNames,
              openrouterModelId: slug
            }, { surfaceErrors: true })
            const prose = enrichmentToProjectFields(enrichment)
            const candidate: ScriptAnalyzeCandidate = {
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
        return { modelId: cfg.id, label: cfg.label, error: lastError }
      })
    )

    completeScriptAnalyzePreviewJob(jobId, {
      candidates: candidates.filter((c): c is ScriptAnalyzeCandidate => Boolean(c)),
      assetId
    })
  } catch (e: unknown) {
    failScriptAnalyzeJob(jobId, e instanceof Error ? e.message : String(e) || 'Analysis preview failed')
  }
}

/** Async apply: run director analysis (chosen model or default) and store the updated project. */
export async function runScriptAnalyzeApplyJob (input: {
  jobId: string
  userId: string
  projectId: string
  assetId?: string
  chosenModelId?: string
}): Promise<void> {
  const { jobId, userId, projectId, assetId, chosenModelId } = input
  try {
    const pb = await getAuthenticatedPocketBase()

    if (chosenModelId) {
      const cfg = getConceptGeneratorModelById(chosenModelId)
      if (!cfg) {
        failScriptAnalyzeJob(jobId, 'Unknown model choice')
        return
      }
      const { parsed, filename, assetId: resolvedAssetId } = await loadWorkflowScreenplayParsedForProject({
        userId,
        pb,
        projectId,
        assetId
      })
      const result = await runDirectorOnlyFromParsed({
        userId,
        pb,
        filename,
        parsed,
        existingProjectId: projectId,
        reuseAssetId: resolvedAssetId,
        openrouterModelId: cfg.openrouterModelId,
        preferredModelId: cfg.id
      })
      completeScriptAnalyzeApplyJob(jobId, result)
      return
    }

    const result = await analyzeScriptImportForProject({
      userId,
      pb,
      projectId,
      assetId
    })
    completeScriptAnalyzeApplyJob(jobId, result)
  } catch (e: unknown) {
    failScriptAnalyzeJob(jobId, e instanceof Error ? e.message : String(e) || 'Director analysis failed')
  }
}
