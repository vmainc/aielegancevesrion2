import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createError } from 'h3'

/** Staged MP3 from Lyria before optional project library save (~15MB cap). */
export const MUSIC_GENERATION_MAX_BYTES = 15 * 1024 * 1024

const MUSIC_DIR = join(process.cwd(), '.data', 'music-generation')

export function newMusicGenerationResultId (): string {
  return randomBytes(16).toString('hex')
}

export async function saveMusicGenerationResult (id: string, data: Buffer): Promise<void> {
  if (data.length > MUSIC_GENERATION_MAX_BYTES) {
    throw createError({
      statusCode: 413,
      message: 'Generated audio is too large to stage.'
    })
  }
  await mkdir(MUSIC_DIR, { recursive: true })
  await writeFile(join(MUSIC_DIR, `${id}.mp3`), data)
}

export async function readMusicGenerationResult (
  id: string
): Promise<{ data: Buffer; mime: string } | null> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return null
  const path = join(MUSIC_DIR, `${id}.mp3`)
  try {
    const data = await readFile(path)
    return { data, mime: 'audio/mpeg' }
  } catch {
    return null
  }
}

export async function deleteMusicGenerationResult (id: string): Promise<void> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return
  await unlink(join(MUSIC_DIR, `${id}.mp3`)).catch(() => {})
}

export async function pruneOldMusicGenerationResults (maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await mkdir(MUSIC_DIR, { recursive: true })
    const { stat } = await import('node:fs/promises')
    const now = Date.now()
    for (const name of await readdir(MUSIC_DIR)) {
      if (!name.endsWith('.mp3')) continue
      const path = join(MUSIC_DIR, name)
      const st = await stat(path)
      if (now - st.mtimeMs > maxAgeMs) {
        await unlink(path).catch(() => {})
      }
    }
  } catch {
    /* ignore */
  }
}

export const MUSIC_RESULT_PATH_PREFIX = '/api/generate/music/result/'

export function musicResultPlaybackPath (resultId: string): string {
  return `${MUSIC_RESULT_PATH_PREFIX}${encodeURIComponent(resultId)}`
}

export function parseMusicResultIdFromPath (url: string): string | null {
  let pathOnly = url.trim().split('?')[0]?.split('#')[0] || ''
  if (/^https?:\/\//i.test(pathOnly)) {
    try {
      pathOnly = new URL(pathOnly).pathname
    } catch {
      return null
    }
  }
  const m = /^\/api\/generate\/music\/result\/([^/]+)$/.exec(pathOnly)
  if (!m) return null
  try {
    return decodeURIComponent(m[1]!)
  } catch {
    return null
  }
}
