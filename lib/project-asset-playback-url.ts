/**
 * Browser `<video src>` cannot send `Authorization`, so project file playback
 * goes through Nitro with `?access_token=` (see `GET .../assets/:id/media`).
 */
export function projectAssetMediaPath (projectId: string, assetId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/media`
}

export function isProjectAssetMediaPath (url: string): boolean {
  const pathOnly = (url.trim().split('#')[0] || '').split('?')[0] || ''
  return /^\/api\/projects\/[^/]+\/assets\/[^/]+\/media$/.test(pathOnly)
}

export function appendPlaybackAccessToken (url: string, token: string | null | undefined): string {
  const u = url.trim()
  if (!u || !token?.trim()) return u
  if (/[?&]access_token=/.test(u)) return u
  if (!isProjectAssetMediaPath(u)) return u
  const join = u.includes('?') ? '&' : '?'
  return `${u}${join}access_token=${encodeURIComponent(token.trim())}`
}
