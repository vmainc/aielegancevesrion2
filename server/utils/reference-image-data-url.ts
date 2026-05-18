import { createError } from 'h3'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i

/** Normalize client upload (data URL) for OpenRouter vision input. */
export function normalizeReferenceImageDataUrl (raw: unknown, maxBytes = 4_000_000): string | null {
  if (typeof raw !== 'string') return null
  const u = raw.trim()
  if (!u) return null

  if (u.startsWith('data:image/')) {
    const m = DATA_URL_RE.exec(u.replace(/\s/g, ''))
    if (!m) {
      throw createError({ statusCode: 400, message: 'Invalid reference image data URL' })
    }
    const b64 = m[2]!
    const approxBytes = Math.floor((b64.length * 3) / 4)
    if (approxBytes > maxBytes) {
      throw createError({ statusCode: 400, message: 'Reference image is too large (max ~4MB)' })
    }
    return `data:${m[1]};base64,${b64}`
  }

  return fetchReferenceImageAsDataUrl(u, maxBytes)
}

export async function fetchReferenceImageAsDataUrl (
  imageUrl: string,
  maxBytes: number
): Promise<string> {
  const u = imageUrl.trim()
  if (u.startsWith('data:image/')) {
    return normalizeReferenceImageDataUrl(u, maxBytes) as string
  }

  const res = await fetchWithTimeout(
    u,
    { method: 'GET', headers: { Accept: 'image/*' } },
    30_000
  )
  if (!res.ok) {
    throw createError({ statusCode: 400, message: `Could not download reference image (HTTP ${res.status})` })
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > maxBytes) {
    throw createError({ statusCode: 400, message: 'Reference image is too large (max ~4MB)' })
  }
  const ct = (res.headers.get('content-type') || '').split(';')[0]?.trim() || 'image/jpeg'
  return `data:${ct};base64,${buf.toString('base64')}`
}
