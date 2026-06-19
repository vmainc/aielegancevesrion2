import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { bootstrapProjectFromConcept } from '~/server/utils/bootstrap-project-from-concept'
import type { ProjectDirector } from '~/types/creative-project'
import {
  completeScriptImportJob,
  failScriptImportJob
} from '~/server/utils/script-import-job-registry'

export async function runConceptBootstrapJob (input: {
  jobId: string
  userId: string
  projectId: string
  title?: string
  logline?: string
  summary?: string
  genre?: string
  tone?: string
  characters?: string[]
  director?: import('~/types/creative-project').ProjectDirector
  visualReference?: string
  targetDurationSeconds?: number
}): Promise<void> {
  try {
    const pb = await getAuthenticatedPocketBase()
    const result = await bootstrapProjectFromConcept({
      userId: input.userId,
      pb,
      projectId: input.projectId,
      title: input.title,
      logline: input.logline,
      summary: input.summary,
      genre: input.genre,
      tone: input.tone,
      characters: input.characters,
      director: input.director,
      visualReference: input.visualReference,
      targetDurationSeconds: input.targetDurationSeconds
    })

    completeScriptImportJob(input.jobId, {
      projectId: input.projectId,
      project: result.project,
      scriptAsset: { ok: true, message: 'Built from story idea' },
      storyboard: result.storyboard,
      sceneCount: result.sceneCount
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[concept-bootstrap-job]', input.jobId, msg)
    failScriptImportJob(input.jobId, msg)
  }
}
