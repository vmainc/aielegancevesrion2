import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import {
  completeGenerateShotsJob,
  failGenerateShotsJob
} from '~/server/utils/generate-shots-job-registry'
import { executeGenerateShots } from '~/server/utils/execute-generate-shots'

export async function runGenerateShotsJob (opts: {
  jobId: string
  userId: string
  projectId: string
  sceneId: string
}): Promise<void> {
  const { jobId, userId, projectId, sceneId } = opts
  try {
    const pb = await getAuthenticatedPocketBase()
    const result = await executeGenerateShots({ userId, pb, projectId, sceneId })
    completeGenerateShotsJob(jobId, {
      projectId,
      sceneId,
      shots: result.shots,
      persisted: result.persisted,
      warning: result.warning,
      continuity: result.continuity
    })
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; data?: { message?: string } }
    const msg =
      err?.data?.message ||
      err?.statusMessage ||
      (e instanceof Error ? e.message : '') ||
      'Shot generation failed'
    console.error('[run-generate-shots-job]', jobId, msg)
    failGenerateShotsJob(jobId, msg || 'Shot generation failed')
  }
}
