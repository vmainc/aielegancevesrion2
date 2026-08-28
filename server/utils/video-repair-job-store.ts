import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createError } from 'h3'
import type { RepairCategoryId } from '~/lib/video-repair/categories'
import type {
  RepairEngineChoice,
  RepairMode,
  VideoRepairJobStatus,
  VideoRepairProviderId
} from '~/lib/video-repair/types'
import { getVideoRepairLimits } from '~/server/utils/video-repair-config'

const JOB_DIR = join(process.cwd(), '.data', 'video-repair', 'jobs')

export type StoredVideoRepairJob = {
  id: string
  userId: string
  provider: VideoRepairProviderId
  model: string
  status: VideoRepairJobStatus
  sourceVideo: string
  outputVideo: string | null
  createdAt: string
  completedAt: string | null
  error: string | null
  estimatedCost: number | null
  actualCost: number | null
  durationSeconds: number | null
  /** Provider job id — persisted so refresh/restart can resume polling. */
  providerJobId: string
  pollUrl: string
  publicToken: string
  sourceMediaId?: string
  referenceMediaId?: string
  outputMediaId?: string
  projectId?: string
  sceneId?: string
  shotId?: string
  characterId?: string
  sourceAssetId?: string
  categories: RepairCategoryId[]
  repairMode: RepairMode
  engineChoice: RepairEngineChoice
  userDescription: string
  prompt: string
  referenceTimestampSeconds?: number
}

export function newVideoRepairJobId (): string {
  return randomBytes(16).toString('hex')
}

function jobPath (id: string): string {
  return join(JOB_DIR, `${id}.json`)
}

export async function saveVideoRepairJob (job: StoredVideoRepairJob): Promise<void> {
  await mkdir(JOB_DIR, { recursive: true })
  await writeFile(jobPath(job.id), JSON.stringify(job, null, 2), 'utf8')
}

export async function readVideoRepairJob (id: string): Promise<StoredVideoRepairJob | null> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return null
  try {
    const raw = await readFile(jobPath(id), 'utf8')
    const parsed = JSON.parse(raw) as StoredVideoRepairJob
    if (!parsed?.id || parsed.id !== id) return null
    return parsed
  } catch {
    return null
  }
}

export async function findVideoRepairJobByPublicToken (
  token: string
): Promise<StoredVideoRepairJob | null> {
  const t = token.trim()
  if (!/^[a-f0-9]{32,64}$/i.test(t)) return null
  await mkdir(JOB_DIR, { recursive: true })
  for (const name of await readdir(JOB_DIR)) {
    if (!name.endsWith('.json')) continue
    try {
      const raw = await readFile(join(JOB_DIR, name), 'utf8')
      const job = JSON.parse(raw) as StoredVideoRepairJob
      if (job.publicToken === t) return job
    } catch {
      /* skip */
    }
  }
  return null
}

export async function countActiveRepairJobsForUser (userId: string): Promise<number> {
  await mkdir(JOB_DIR, { recursive: true })
  let n = 0
  for (const name of await readdir(JOB_DIR)) {
    if (!name.endsWith('.json')) continue
    try {
      const raw = await readFile(join(JOB_DIR, name), 'utf8')
      const job = JSON.parse(raw) as StoredVideoRepairJob
      if (job.userId !== userId) continue
      if (job.status === 'pending' || job.status === 'in_progress' || job.status === 'queued') n += 1
    } catch {
      /* skip */
    }
  }
  return n
}

export async function assertConcurrentRepairAllowed (userId: string): Promise<void> {
  const { maxConcurrentJobs } = getVideoRepairLimits()
  const n = await countActiveRepairJobsForUser(userId)
  if (n >= maxConcurrentJobs) {
    throw createError({
      statusCode: 429,
      message: `You already have ${n} repair${n === 1 ? '' : 's'} in progress (limit ${maxConcurrentJobs}). Wait for one to finish.`
    })
  }
}

export async function pruneOldVideoRepairJobs (maxAgeMs = 36 * 60 * 60 * 1000): Promise<void> {
  try {
    await mkdir(JOB_DIR, { recursive: true })
    const { stat } = await import('node:fs/promises')
    const now = Date.now()
    for (const name of await readdir(JOB_DIR)) {
      if (!name.endsWith('.json')) continue
      const path = join(JOB_DIR, name)
      const st = await stat(path)
      if (now - st.mtimeMs > maxAgeMs) await unlink(path).catch(() => {})
    }
  } catch {
    /* ignore */
  }
}

export function publicJobView (job: StoredVideoRepairJob) {
  return {
    id: job.id,
    provider: job.provider,
    model: job.model,
    status: job.status,
    sourceVideo: job.sourceVideo,
    outputVideo: job.outputVideo,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    error: job.error,
    durationSeconds: job.durationSeconds,
    projectId: job.projectId || null,
    sceneId: job.sceneId || null,
    shotId: job.shotId || null,
    sourceAssetId: job.sourceAssetId || null,
    categories: job.categories,
    repairMode: job.repairMode,
    engineChoice: job.engineChoice,
    userDescription: job.userDescription,
    referenceTimestampSeconds: job.referenceTimestampSeconds ?? null
  }
}
