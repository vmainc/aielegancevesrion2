import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createError } from 'h3'

export const IMAGE_GENERATION_STAGE_MAX_BYTES = 25 * 1024 * 1024

const IMAGE_DIR = join(process.cwd(), '.data', 'image-generations')

export function newImageGenerationStageId (): string {
  return randomBytes(16).toString('hex')
}

function extForMime (mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  if (m.includes('webp')) return 'webp'
  if (m.includes('gif')) return 'gif'
  return 'png'
}

export async function saveStagedGeneratedImage (
  generationId: string,
  index: number,
  data: Buffer,
  mime: string
): Promise<{ filename: string; mime: string; bytes: number }> {
  if (data.length > IMAGE_GENERATION_STAGE_MAX_BYTES) {
    throw createError({
      statusCode: 413,
      message: 'Generated image is too large to store.'
    })
  }
  if (!/^[a-f0-9]{32}$/i.test(generationId)) {
    throw createError({ statusCode: 400, message: 'Invalid generation id' })
  }
  const dir = join(IMAGE_DIR, generationId)
  await mkdir(dir, { recursive: true })
  const ext = extForMime(mime)
  const filename = `${index}.${ext}`
  await writeFile(join(dir, filename), data)
  await writeFile(
    join(dir, `${index}.meta.json`),
    JSON.stringify({ mime, bytes: data.length, filename }),
    'utf8'
  )
  return { filename, mime, bytes: data.length }
}

export async function readStagedGeneratedImage (
  generationId: string,
  index: number
): Promise<{ data: Buffer; mime: string } | null> {
  if (!/^[a-f0-9]{32}$/i.test(generationId)) return null
  if (!Number.isInteger(index) || index < 0 || index > 15) return null
  const dir = join(IMAGE_DIR, generationId)
  try {
    const metaRaw = await readFile(join(dir, `${index}.meta.json`), 'utf8')
    const meta = JSON.parse(metaRaw) as { mime?: string; filename?: string }
    const filename = meta.filename || `${index}.png`
    const data = await readFile(join(dir, filename))
    return { data, mime: meta.mime || 'image/png' }
  } catch {
    return null
  }
}

export function stagedGeneratedImagePublicPath (generationId: string, index: number): string {
  return `/api/generate/images/media/${encodeURIComponent(generationId)}/${index}`
}

export async function pruneOldStagedGeneratedImages (maxAgeMs = 48 * 60 * 60 * 1000): Promise<void> {
  try {
    await mkdir(IMAGE_DIR, { recursive: true })
    const now = Date.now()
    for (const name of await readdir(IMAGE_DIR)) {
      if (!/^[a-f0-9]{32}$/i.test(name)) continue
      const path = join(IMAGE_DIR, name)
      try {
        const st = await stat(path)
        if (now - st.mtimeMs > maxAgeMs) {
          const files = await readdir(path)
          for (const f of files) {
            await unlink(join(path, f)).catch(() => {})
          }
          const { rmdir } = await import('node:fs/promises')
          await rmdir(path).catch(() => {})
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}
