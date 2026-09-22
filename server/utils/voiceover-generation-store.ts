import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createError } from 'h3'

export const VOICEOVER_GENERATION_MAX_BYTES = 15 * 1024 * 1024

const VOICEOVER_DIR = join(process.cwd(), '.data', 'voiceover-generation')

export function newVoiceoverGenerationResultId (): string {
  return randomBytes(16).toString('hex')
}

export async function saveVoiceoverGenerationResult (id: string, data: Buffer): Promise<void> {
  if (data.length > VOICEOVER_GENERATION_MAX_BYTES) {
    throw createError({
      statusCode: 413,
      message: 'Generated voiceover is too large to stage.'
    })
  }
  await mkdir(VOICEOVER_DIR, { recursive: true })
  await writeFile(join(VOICEOVER_DIR, `${id}.mp3`), data)
}

export async function readVoiceoverGenerationResult (
  id: string
): Promise<{ data: Buffer; mime: string } | null> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return null
  const path = join(VOICEOVER_DIR, `${id}.mp3`)
  try {
    const data = await readFile(path)
    return { data, mime: 'audio/mpeg' }
  } catch {
    return null
  }
}

export async function deleteVoiceoverGenerationResult (id: string): Promise<void> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return
  await unlink(join(VOICEOVER_DIR, `${id}.mp3`)).catch(() => {})
}

export async function pruneOldVoiceoverGenerationResults (maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await mkdir(VOICEOVER_DIR, { recursive: true })
    const { stat } = await import('node:fs/promises')
    const now = Date.now()
    for (const name of await readdir(VOICEOVER_DIR)) {
      if (!name.endsWith('.mp3')) continue
      const path = join(VOICEOVER_DIR, name)
      const st = await stat(path)
      if (now - st.mtimeMs > maxAgeMs) {
        await unlink(path).catch(() => {})
      }
    }
  } catch {
    /* ignore */
  }
}

export const VOICEOVER_RESULT_PATH_PREFIX = '/api/generate/voiceover/result/'

export function voiceoverResultPlaybackPath (resultId: string): string {
  return `${VOICEOVER_RESULT_PATH_PREFIX}${encodeURIComponent(resultId)}`
}

export function parseVoiceoverResultIdFromPath (url: string): string | null {
  let pathOnly = url.trim().split('?')[0]?.split('#')[0] || ''
  if (/^https?:\/\//i.test(pathOnly)) {
    try {
      pathOnly = new URL(pathOnly).pathname
    } catch {
      return null
    }
  }
  const m = /^\/api\/generate\/voiceover\/result\/([^/]+)$/.exec(pathOnly)
  if (!m) return null
  try {
    return decodeURIComponent(m[1]!)
  } catch {
    return m[1] || null
  }
}
