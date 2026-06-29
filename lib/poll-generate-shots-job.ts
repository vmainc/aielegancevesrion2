import type { ContinuityCheckSummary } from '~/lib/continuity-check-result'
import type { CreativeShot } from '~/types/creative-shot'

export async function pollGenerateShotsJob (
  jobId: string,
  headers: Record<string, string>,
  options?: { intervalMs?: number; maxMs?: number }
): Promise<{
  shots: CreativeShot[]
  persisted?: boolean
  warning?: string
  continuity?: ContinuityCheckSummary
}> {
  const intervalMs = options?.intervalMs ?? 3500
  const maxMs = options?.maxMs ?? 12 * 60 * 1000
  const started = Date.now()

  while (Date.now() - started < maxMs) {
    const res = await $fetch<{
      status: string
      shots?: CreativeShot[]
      persisted?: boolean
      warning?: string
      continuity?: ContinuityCheckSummary
      message?: string
    }>(`/api/generate-shots/jobs/${encodeURIComponent(jobId)}`, { headers })

    if (res.status === 'completed' && Array.isArray(res.shots)) {
      return {
        shots: res.shots,
        persisted: res.persisted,
        warning: res.warning,
        continuity: res.continuity
      }
    }
    if (res.status === 'failed') {
      throw new Error(res.message || 'Shot generation failed')
    }

    await new Promise(r => setTimeout(r, intervalMs))
  }

  throw new Error(
    'Shot generation timed out while waiting for the server. Refresh the page — shots may still appear if the job finished.'
  )
}
