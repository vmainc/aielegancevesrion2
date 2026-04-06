/**
 * - Localhost in config + page on a real host → use `https?://<page-host>/pb` (nginx-style).
 * - Same hostname but config used port 80/443 while the page is on another port (e.g. :3000) →
 *   use `<page-origin>/pb` so requests hit Nitro's `/pb` proxy (avoids cross-origin CORS on login).
 */
export function resolveBrowserPocketBaseUrl(configUrl: string): string {
  if (typeof window === 'undefined') {
    return configUrl
  }
  let u: URL
  try {
    u = new URL(configUrl)
  } catch {
    return configUrl
  }
  const pageHost = window.location.hostname
  const pageLocal = pageHost === '127.0.0.1' || pageHost === 'localhost'

  const configLocal = u.hostname === '127.0.0.1' || u.hostname === 'localhost'
  if (configLocal) {
    if (pageLocal) {
      return configUrl
    }
    const proto = window.location.protocol
    return `${proto}//${pageHost}/pb`.replace(/\/+$/, '')
  }

  const pathNorm = (u.pathname.replace(/\/+$/, '') || '/').replace(/\/+/g, '/')
  const configIsPbPath = pathNorm === '/pb'
  // Build used a different host than this page (e.g. VPS IP in env vs https://aielegance.com).
  // PocketBase auth is keyed by base URL — must use same origin as the app or you get 401/404.
  if (configIsPbPath && u.hostname !== pageHost) {
    return `${window.location.origin}/pb`.replace(/\/+$/, '')
  }
  if (configIsPbPath && u.hostname === pageHost) {
    return `${window.location.origin}/pb`.replace(/\/+$/, '')
  }

  return configUrl
}
