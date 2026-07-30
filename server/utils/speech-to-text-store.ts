import { randomBytes } from 'node:crypto'
import { mkdir, readdir, unlink, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  SpeechToTextJobStatus,
  SpeechToTextOptions,
  SpeechToTextResult
} from '~/lib/speech-to-text'
import { SPEECH_TO_TEXT_MAX_BYTES } from '~/lib/speech-to-text'

const STT_DIR = join(process.cwd(), '.data', 'speech-to-text')

export type SpeechToTextJobRecord = {
  status: SpeechToTextJobStatus
  userId: string
  filename: string
  mime: string
  size: number
  options: SpeechToTextOptions
  phase?: 'uploading' | 'transcribing'
  result?: SpeechToTextResult
  message?: string
  /** Prevents double-counting if a billing hook is added later. */
  usageCharged: boolean
  createdAt: number
  completedAt?: number
  /** Absolute path to staged audio; deleted after success/failure. */
  stagedPath?: string
}

const jobs = new Map<string, SpeechToTextJobRecord>()
const TTL_MS = 60 * 60 * 1000
/** In-flight submit locks keyed by userId+filename+size to block duplicate posts. */
const submitLocks = new Map<string, number>()

function pruneJobs () {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (now - job.createdAt > TTL_MS) {
      if (job.stagedPath) void unlink(job.stagedPath).catch(() => {})
      jobs.delete(id)
    }
  }
  for (const [key, ts] of submitLocks) {
    if (now - ts > 120_000) submitLocks.delete(key)
  }
}

export function newSpeechToTextJobId (): string {
  return randomBytes(16).toString('hex')
}

export function speechToTextDuplicateKey (userId: string, filename: string, size: number): string {
  return `${userId}:${filename.trim().toLowerCase()}:${size}`
}

export function tryAcquireSpeechToTextSubmitLock (key: string): boolean {
  pruneJobs()
  const now = Date.now()
  const existing = submitLocks.get(key)
  if (existing && now - existing < 90_000) return false
  submitLocks.set(key, now)
  return true
}

export function releaseSpeechToTextSubmitLock (key: string): void {
  submitLocks.delete(key)
}

export function registerSpeechToTextJob (jobId: string, entry: Omit<SpeechToTextJobRecord, 'createdAt' | 'usageCharged'> & { usageCharged?: boolean }): void {
  pruneJobs()
  jobs.set(jobId.trim(), {
    ...entry,
    usageCharged: entry.usageCharged === true,
    createdAt: Date.now()
  })
}

export function getSpeechToTextJob (jobId: string): SpeechToTextJobRecord | null {
  pruneJobs()
  return jobs.get(jobId.trim()) ?? null
}

export function updateSpeechToTextJob (
  jobId: string,
  patch: Partial<Omit<SpeechToTextJobRecord, 'createdAt' | 'userId'>>
): void {
  const id = jobId.trim()
  const cur = jobs.get(id)
  if (!cur) return
  jobs.set(id, { ...cur, ...patch })
}

export async function ensureSpeechToTextDir (): Promise<string> {
  await mkdir(STT_DIR, { recursive: true })
  return STT_DIR
}

export async function stageSpeechToTextAudio (input: {
  jobId: string
  filename: string
  data: Buffer
}): Promise<string> {
  if (input.data.length > SPEECH_TO_TEXT_MAX_BYTES) {
    throw new Error(`File is too large (max ${Math.floor(SPEECH_TO_TEXT_MAX_BYTES / (1024 * 1024))} MB).`)
  }
  const dir = await ensureSpeechToTextDir()
  const safe = input.filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'audio'
  const path = join(dir, `${input.jobId}-${safe}`)
  await writeFile(path, input.data)
  return path
}

export async function deleteStagedSpeechToTextAudio (path: string | undefined): Promise<void> {
  if (!path) return
  await unlink(path).catch(() => {})
}

export async function pruneOldSpeechToTextFiles (maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await ensureSpeechToTextDir()
    const now = Date.now()
    for (const name of await readdir(STT_DIR)) {
      const path = join(STT_DIR, name)
      const st = await stat(path)
      if (now - st.mtimeMs > maxAgeMs) {
        await unlink(path).catch(() => {})
      }
    }
  } catch {
    /* ignore */
  }
}
