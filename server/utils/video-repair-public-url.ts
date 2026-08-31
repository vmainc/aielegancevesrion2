import { createError } from 'h3'
import { getVideoRepairPublicBaseUrl } from '~/server/utils/video-repair-config'
import { videoRepairPublicPath } from '~/server/utils/video-repair-media-store'

/**
 * Normalize an origin providers can fetch. OpenRouter Aleph requires HTTPS
 * (not data: and not http:). Behind nginx TLS termination, Node often sees http://.
 */
export function normalizeProviderOrigin (origin: string): string | null {
  const raw = (origin || '').trim().replace(/\/+$/, '')
  if (!raw || !/^https?:\/\//i.test(raw)) return null
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
      return null
    }
    if (u.protocol === 'http:') u.protocol = 'https:'
    return u.origin
  } catch {
    return null
  }
}

/**
 * URL providers (OpenRouter / Luma) can GET without our user JWT.
 * Localhost is not reachable from those providers unless a tunnel base is set.
 */
export function buildProviderFetchableUrl (opts: {
  publicToken: string
  requestOrigin?: string
}): string | null {
  const configured = getVideoRepairPublicBaseUrl()
  const origin = normalizeProviderOrigin(configured || opts.requestOrigin || '')
  if (!origin) return null
  return `${origin}${videoRepairPublicPath(opts.publicToken)}`
}

export function isLocalhostUrl (url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase()
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0'
  } catch {
    return false
  }
}

/** OpenRouter video_url only accepts https:// — not data: or http:. */
export function assertHttpsProviderMediaUrl (url: string, label = 'Source video'): string {
  const u = (url || '').trim()
  if (/^https:\/\//i.test(u)) return u
  if (u.startsWith('data:')) {
    throw createError({
      statusCode: 400,
      message: `${label} must be a public HTTPS URL for Aleph (data URIs are not allowed).`
    })
  }
  if (/^http:\/\//i.test(u)) {
    return `https://${u.slice('http://'.length)}`
  }
  throw createError({
    statusCode: 400,
    message: `${label} must be a public HTTPS URL. Set VIDEO_REPAIR_PUBLIC_BASE_URL=https://aifilmstud.io on the server.`
  })
}
