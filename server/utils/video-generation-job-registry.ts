/**
 * In-memory registry so short HTTP requests can poll video jobs without holding the original POST open.
 * Single Node process (typical VPS). Jobs expire after TTL.
 */
type RegistryEntry = {
  pollUrl: string
  apiKey: string
  model: string
  userId: string
  createdAt: number
  provider: 'openrouter' | 'atlascloud'
}

const jobs = new Map<string, RegistryEntry>()
const TTL_MS = 25 * 60 * 1000

function prune () {
  const now = Date.now()
  for (const [id, v] of jobs) {
    if (now - v.createdAt > TTL_MS) jobs.delete(id)
  }
}

export function registerVideoGenerationJob (
  jobId: string,
  entry: Omit<RegistryEntry, 'createdAt'>
): void {
  prune()
  jobs.set(jobId.trim(), { ...entry, createdAt: Date.now() })
}

export function takeVideoGenerationJob (jobId: string): RegistryEntry | null {
  prune()
  const id = jobId.trim()
  const v = jobs.get(id)
  return v ?? null
}

export function removeVideoGenerationJob (jobId: string): void {
  jobs.delete(jobId.trim())
}
