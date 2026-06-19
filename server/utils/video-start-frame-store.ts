import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createError } from 'h3'
import { VIDEO_SEED_FRAME_MAX_BYTES } from '~/lib/video-start-frame-limits'

export const VIDEO_START_FRAME_MAX_BYTES = VIDEO_SEED_FRAME_MAX_BYTES

const FRAME_DIR = join(process.cwd(), '.data', 'video-start-frames')

function extForMime (mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

function mimeForExt (ext: string): string {
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

export function newVideoStartFrameId (): string {
  return randomBytes(16).toString('hex')
}

export async function saveVideoStartFrame (
  id: string,
  data: Buffer,
  mime: string
): Promise<void> {
  if (data.length > VIDEO_START_FRAME_MAX_BYTES) {
    throw createError({
      statusCode: 413,
      message: 'Starting frame image is too large (max 4MB). Use a smaller image.'
    })
  }
  await mkdir(FRAME_DIR, { recursive: true })
  const ext = extForMime(mime)
  await writeFile(join(FRAME_DIR, `${id}.${ext}`), data)
}

export async function readVideoStartFrame (
  id: string
): Promise<{ data: Buffer; mime: string } | null> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return null
  await mkdir(FRAME_DIR, { recursive: true })
  const files = await readdir(FRAME_DIR)
  const match = files.find(f => f.startsWith(`${id}.`))
  if (!match) return null
  const ext = match.split('.').pop() || 'jpg'
  const data = await readFile(join(FRAME_DIR, match))
  return { data, mime: mimeForExt(ext) }
}

/** Best-effort cleanup of frames older than 24h (by mtime). */
export async function pruneOldVideoStartFrames (maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await mkdir(FRAME_DIR, { recursive: true })
    const { readdir, stat } = await import('node:fs/promises')
    const now = Date.now()
    for (const name of await readdir(FRAME_DIR)) {
      const path = join(FRAME_DIR, name)
      const st = await stat(path)
      if (now - st.mtimeMs > maxAgeMs) {
        await unlink(path).catch(() => {})
      }
    }
  } catch {
    /* ignore */
  }
}
