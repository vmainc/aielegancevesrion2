import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createError } from 'h3'

export const CONCEPT_REFERENCE_IMAGE_MAX_BYTES = 2_500_000

const IMAGE_DIR = join(process.cwd(), '.data', 'concept-reference-images')

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

export function newConceptReferenceImageId (): string {
  return randomBytes(16).toString('hex')
}

export async function saveConceptReferenceImage (
  id: string,
  data: Buffer,
  mime: string
): Promise<void> {
  if (data.length > CONCEPT_REFERENCE_IMAGE_MAX_BYTES) {
    throw createError({
      statusCode: 413,
      message: 'Reference image is too large after compression. Try a smaller file.'
    })
  }
  await mkdir(IMAGE_DIR, { recursive: true })
  const ext = extForMime(mime)
  await writeFile(join(IMAGE_DIR, `${id}.${ext}`), data)
}

export async function readConceptReferenceImage (
  id: string
): Promise<{ data: Buffer; mime: string } | null> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return null
  await mkdir(IMAGE_DIR, { recursive: true })
  const files = await readdir(IMAGE_DIR)
  const match = files.find(f => f.startsWith(`${id}.`))
  if (!match) return null
  const ext = match.split('.').pop() || 'jpg'
  const data = await readFile(join(IMAGE_DIR, match))
  return { data, mime: mimeForExt(ext) }
}

export async function pruneOldConceptReferenceImages (maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await mkdir(IMAGE_DIR, { recursive: true })
    const { stat } = await import('node:fs/promises')
    const now = Date.now()
    for (const name of await readdir(IMAGE_DIR)) {
      const path = join(IMAGE_DIR, name)
      const st = await stat(path)
      if (now - st.mtimeMs > maxAgeMs) {
        await unlink(path).catch(() => {})
      }
    }
  } catch {
    /* ignore */
  }
}
