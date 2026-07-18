import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import {
  completeScriptImportJob,
  failScriptImportJob
} from '~/server/utils/script-import-job-registry'
import {
  downloadProjectAssetFileBuffer,
  loadWorkflowScreenplayParsedForProject,
  runFullImportFromParsed,
  type AspectRatio,
  type ProjectGoal
} from '~/server/utils/import-script-core'
import { getConceptGeneratorModelById } from '~/lib/concept-generator-models'

export async function runProjectFullImportJob (input: {
  jobId: string
  userId: string
  projectId: string
  assetId?: string
  chosenModelId?: string
}): Promise<void> {
  const { jobId, userId, projectId, assetId } = input
  try {
    const pb = await getAuthenticatedPocketBase()

    const { parsed, filename, assetId: resolvedAssetId } = await loadWorkflowScreenplayParsedForProject({
      userId,
      pb,
      projectId,
      assetId
    })

    const assetRow = await pb.collection('project_assets').getOne(resolvedAssetId)
    const fileBuf = await downloadProjectAssetFileBuffer(pb, assetRow as Record<string, unknown>)

    const projectRow = await pb.collection('creative_projects').getOne(projectId) as Record<string, unknown>

    const aspectRatio: AspectRatio =
      String(projectRow.aspect_ratio || '16:9') === '9:16'
        ? '9:16'
        : String(projectRow.aspect_ratio) === '1:1'
          ? '1:1'
          : '16:9'
    const goalRaw = String(projectRow.goal || 'film')
    const goal: ProjectGoal =
      goalRaw === 'social' || goalRaw === 'commercial' || goalRaw === 'other' ? goalRaw : 'film'
    const chosenModel = getConceptGeneratorModelById(input.chosenModelId || 'gpt-4o')
      || getConceptGeneratorModelById('gpt-4o')

    const { project, scriptAsset } = await runFullImportFromParsed({
      userId,
      pb,
      fileBuf,
      filename,
      parsed,
      aspectRatio,
      goal,
      existingProjectId: projectId,
      reuseAssetId: resolvedAssetId,
      preferredModelId: chosenModel?.id || 'gpt-4o',
      openrouterModelId: chosenModel?.openrouterModelId || 'openai/gpt-4o'
    })

    completeScriptImportJob(jobId, {
      projectId: project.id,
      project,
      scriptAsset
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    failScriptImportJob(jobId, msg || 'Full script import failed')
  }
}
