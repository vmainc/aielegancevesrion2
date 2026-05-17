/**
 * Browser `<video src>` cannot send `Authorization`, so project file playback
 * goes through Nitro with `?access_token=` (see `GET .../assets/:id/media`).
 */
export function projectAssetMediaPath (projectId: string, assetId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/media`
}

export function projectAssetMediaPathOnly (url: string): string {
  return (url.trim().split('#')[0] || '').split('?')[0] || ''
}

export function isProjectAssetMediaPath (url: string): boolean {
  return /^\/api\/projects\/[^/]+\/assets\/[^/]+\/media$/.test(projectAssetMediaPathOnly(url))
}

/** Parse `projectAssetMediaPath` URLs (query/hash stripped). */
export function parseProjectAssetMediaIds (
  url: string
): { projectId: string; assetId: string } | null {
  const pathOnly = projectAssetMediaPathOnly(url)
  const m = /^\/api\/projects\/([^/]+)\/assets\/([^/]+)\/media$/.exec(pathOnly)
  if (!m) return null
  return { projectId: decodeURIComponent(m[1]), assetId: decodeURIComponent(m[2]) }
}

export function appendPlaybackAccessToken (url: string, token: string | null | undefined): string {
  const u = url.trim()
  if (!u || !token?.trim()) return u
  if (/[?&]access_token=/.test(u)) return u
  if (!isProjectAssetMediaPath(u)) return u
  const join = u.includes('?') ? '&' : '?'
  return `${u}${join}access_token=${encodeURIComponent(token.trim())}`
}
