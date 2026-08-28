import { getVideoRepairPublicBaseUrl } from '~/server/utils/video-repair-config'
import { videoRepairPublicPath } from '~/server/utils/video-repair-media-store'

/**
 * URL providers (OpenRouter / Luma) can GET without our user JWT.
 * Localhost is not reachable from those providers unless a tunnel base is set.
 */
export function buildProviderFetchableUrl (opts: {
  publicToken: string
  requestOrigin?: string
}): string | null {
  const configured = getVideoRepairPublicBaseUrl()
  const origin = (configured || opts.requestOrigin || '').replace(/\/+$/, '')
  if (!origin || !/^https?:\/\//i.test(origin)) return null
  try {
    const host = new URL(origin).hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return null
  } catch {
    return null
  }
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
