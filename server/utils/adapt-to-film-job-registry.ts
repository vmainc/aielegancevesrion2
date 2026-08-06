import { randomBytes } from 'node:crypto'
import type { AdaptJobKind, AdaptJobStatus } from '~/types/adapt-to-film'

export type AdaptJobRecord = {
  jobId: string
  userId: string
  projectId: string
  kind: AdaptJobKind
  status: AdaptJobStatus
  message: string
  result?: unknown
  createdAt: number
  updatedAt: number
  usageCharged: boolean
}

const JOB_TTL_MS = 2 * 60 * 60 * 1000
const SUBMIT_LOCK_TTL_MS = 60_000

const jobs = new Map<string, AdaptJobRecord>()
const submitLocks = new Map<string, number>()

export function newAdaptJobId (): string {
  return randomBytes(16).toString('hex')
}

export function pruneOldJobs (): void {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id)
  }
  for (const [key, ts] of submitLocks) {
    if (now - ts > SUBMIT_LOCK_TTL_MS * 2) submitLocks.delete(key)
  }
}

export function adaptSubmitLockKey (userId: string, projectId: string, kind: AdaptJobKind): string {
  return `${userId}:${projectId}:${kind}`
}

export function tryAcquireAdaptSubmitLock (key: string): boolean {
  pruneOldJobs()
  const now = Date.now()
  const existing = submitLocks.get(key)
  if (existing && now - existing < SUBMIT_LOCK_TTL_MS) return false
  submitLocks.set(key, now)
  return true
}

export function releaseAdaptSubmitLock (key: string): void {
  submitLocks.delete(key)
}

export function createJob (input: {
  userId: string
  projectId: string
  kind: AdaptJobKind
  message?: string
  status?: AdaptJobStatus
}): AdaptJobRecord {
  pruneOldJobs()
  const now = Date.now()
  const jobId = newAdaptJobId()
  const record: AdaptJobRecord = {
    jobId,
    userId: input.userId,
    projectId: input.projectId,
    kind: input.kind,
    status: input.status || 'queued',
    message: input.message || '',
    createdAt: now,
    updatedAt: now,
    usageCharged: false
  }
  jobs.set(jobId, record)
  return record
}

export function getJob (jobId: string): AdaptJobRecord | null {
  pruneOldJobs()
  return jobs.get(jobId.trim()) ?? null
}

export function updateJob (
  jobId: string,
  patch: Partial<Omit<AdaptJobRecord, 'jobId' | 'userId' | 'projectId' | 'kind' | 'createdAt'>>
): AdaptJobRecord | null {
  const id = jobId.trim()
  const cur = jobs.get(id)
  if (!cur) return null
  const next: AdaptJobRecord = {
    ...cur,
    ...patch,
    updatedAt: Date.now()
  }
  jobs.set(id, next)
  return next
}
