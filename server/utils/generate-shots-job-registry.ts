import type { CreativeShot } from '~/types/creative-shot'

export type GenerateShotsJobStatus = 'running' | 'completed' | 'failed'

export type GenerateShotsJobRecord = {
  userId: string
  status: GenerateShotsJobStatus
  createdAt: number
  projectId: string
  sceneId: string
  shots?: CreativeShot[]
  persisted?: boolean
  warning?: string
  continuity?: { issueCount: number; memoryUpdated: boolean }
  error?: string
}

const jobs = new Map<string, GenerateShotsJobRecord>()
const TTL_MS = 35 * 60 * 1000

function prune () {
  const now = Date.now()
  for (const [id, v] of jobs) {
    if (now - v.createdAt > TTL_MS) jobs.delete(id)
  }
}

export function createGenerateShotsJob (userId: string, projectId: string, sceneId: string): string {
  prune()
  const jobId = crypto.randomUUID()
  jobs.set(jobId, {
    userId,
    status: 'running',
    createdAt: Date.now(),
    projectId,
    sceneId
  })
  return jobId
}

export function getGenerateShotsJob (jobId: string, userId: string): GenerateShotsJobRecord | null {
  prune()
  const row = jobs.get(jobId.trim())
  if (!row || row.userId !== userId) return null
  return row
}

export function completeGenerateShotsJob (
  jobId: string,
  result: Omit<GenerateShotsJobRecord, 'userId' | 'status' | 'createdAt'>
): void {
  const row = jobs.get(jobId.trim())
  if (!row) return
  jobs.set(jobId.trim(), {
    ...row,
    status: 'completed',
    ...result
  })
}

export function failGenerateShotsJob (jobId: string, message: string): void {
  const row = jobs.get(jobId.trim())
  if (!row) return
  jobs.set(jobId.trim(), { ...row, status: 'failed', error: message.slice(0, 2000) })
}
