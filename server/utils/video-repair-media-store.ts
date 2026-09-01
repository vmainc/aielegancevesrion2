import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createError } from 'h3'
import { getVideoRepairMaxBytes } from '~/server/utils/video-repair-config'

const MEDIA_DIR = join(process.cwd(), '.data', 'video-repair', 'media')

export function newVideoRepairMediaId (): string {
  return randomBytes(16).toString('hex')
}

export function newVideoRepairPublicToken (): string {
  return randomBytes(24).toString('hex')
}

function extForMime (mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
  if (m.includes('webm')) return 'webm'
  if (m.includes('quicktime') || m.includes('mov')) return 'mov'
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  return 'mp4'
}

function mimeForExt (ext: string): string {
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mov') return 'video/quicktime'
  return 'video/mp4'
}

export async function saveVideoRepairMedia (opts: {
  id: string
  data: Buffer
  mime: string
}): Promise<{ filename: string; mime: string; bytes: number }> {
  const max = getVideoRepairMaxBytes()
  if (opts.data.length > max) {
    throw createError({
      statusCode: 413,
      message: `File is too large (max ${Math.round(max / 1_048_576)}MB).`
    })
  }
  await mkdir(MEDIA_DIR, { recursive: true })
  const ext = extForMime(opts.mime)
  const filename = `${opts.id}.${ext}`
  await writeFile(join(MEDIA_DIR, filename), opts.data)
  return { filename, mime: opts.mime, bytes: opts.data.length }
}

export async function readVideoRepairMedia (
  id: string
): Promise<{ data: Buffer; mime: string } | null> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return null
  await mkdir(MEDIA_DIR, { recursive: true })
  const files = await readdir(MEDIA_DIR)
  const match = files.find(f => f.startsWith(`${id}.`))
  if (!match) return null
  const ext = match.split('.').pop() || 'mp4'
  const data = await readFile(join(MEDIA_DIR, match))
  return { data, mime: mimeForExt(ext) }
}

/** Absolute path to a staged repair media file, or null if missing. */
export async function resolveVideoRepairMediaPath (id: string): Promise<string | null> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return null
  await mkdir(MEDIA_DIR, { recursive: true })
  const files = await readdir(MEDIA_DIR)
  const match = files.find(f => f.startsWith(`${id}.`))
  if (!match) return null
  return join(MEDIA_DIR, match)
}

export async function deleteVideoRepairMedia (id: string): Promise<void> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return
  try {
    await mkdir(MEDIA_DIR, { recursive: true })
    const files = await readdir(MEDIA_DIR)
    for (const name of files) {
      if (name.startsWith(`${id}.`)) await unlink(join(MEDIA_DIR, name)).catch(() => {})
    }
  } catch {
    /* ignore */
  }
}

export const VIDEO_REPAIR_RESULT_PATH_PREFIX = '/api/repair/video/result/'
export const VIDEO_REPAIR_PUBLIC_PATH_PREFIX = '/api/repair/video/public/'

export function videoRepairResultPath (id: string): string {
  return `${VIDEO_REPAIR_RESULT_PATH_PREFIX}${encodeURIComponent(id)}`
}

export function videoRepairPublicPath (token: string): string {
  return `${VIDEO_REPAIR_PUBLIC_PATH_PREFIX}${encodeURIComponent(token)}`
}

export async function pruneOldVideoRepairMedia (maxAgeMs = 36 * 60 * 60 * 1000): Promise<void> {
  try {
    await mkdir(MEDIA_DIR, { recursive: true })
    const { stat } = await import('node:fs/promises')
    const now = Date.now()
    for (const name of await readdir(MEDIA_DIR)) {
      const path = join(MEDIA_DIR, name)
      const st = await stat(path)
      if (now - st.mtimeMs > maxAgeMs) await unlink(path).catch(() => {})
    }
  } catch {
    /* ignore */
  }
}
