import { randomBytes } from 'node:crypto'

export type MusicGenerationJobStatus = 'running' | 'completed' | 'failed'

type RegistryEntry = {
  status: MusicGenerationJobStatus
  model: string
  userId?: string
  resultId?: string
  playbackUrl?: string
  transcript?: string
  message?: string
  createdAt: number
}

const jobs = new Map<string, RegistryEntry>()
const TTL_MS = 25 * 60 * 1000

function prune () {
  const now = Date.now()
  for (const [id, v] of jobs) {
    if (now - v.createdAt > TTL_MS) jobs.delete(id)
  }
}

export function newMusicGenerationJobId (): string {
  return randomBytes(16).toString('hex')
}

export function registerMusicGenerationJob (
  jobId: string,
  entry: Omit<RegistryEntry, 'createdAt'>
): void {
  prune()
  jobs.set(jobId.trim(), { ...entry, createdAt: Date.now() })
}

export function takeMusicGenerationJob (jobId: string): RegistryEntry | null {
  prune()
  return jobs.get(jobId.trim()) ?? null
}

export function updateMusicGenerationJob (
  jobId: string,
  patch: Partial<Omit<RegistryEntry, 'createdAt'>>
): void {
  const id = jobId.trim()
  const cur = jobs.get(id)
  if (!cur) return
  jobs.set(id, { ...cur, ...patch })
}

export function removeMusicGenerationJob (jobId: string): void {
  jobs.delete(jobId.trim())
}
