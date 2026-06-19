import type { ProjectAsset } from '~/types/project-asset'

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

/** Parse `projectAssetMediaPath` URLs (absolute or relative; query/hash stripped). */
export function parseProjectAssetMediaIds (
  url: string
): { projectId: string; assetId: string } | null {
  let pathOnly = url.trim()
  if (/^https?:\/\//i.test(pathOnly)) {
    try {
      pathOnly = new URL(pathOnly).pathname
    } catch {
      return null
    }
  }
  pathOnly = projectAssetMediaPathOnly(pathOnly)
  const m = /^\/api\/projects\/([^/]+)\/assets\/([^/]+)\/media$/.exec(pathOnly)
  if (!m) return null
  return { projectId: decodeURIComponent(m[1]), assetId: decodeURIComponent(m[2]) }
}

/** Browser-safe URL for a project asset file (PocketBase proxy or media API). */
export function projectAssetPlaybackSrc (
  asset: Pick<ProjectAsset, 'id' | 'projectId' | 'fileUrl'>,
  token?: string | null
): string {
  const fileUrl = (asset.fileUrl || '').trim()
  if (fileUrl.startsWith('/pb/')) return fileUrl
  const pid = (asset.projectId || '').trim()
  if (pid && asset.id) {
    return appendPlaybackAccessToken(projectAssetMediaPath(pid, asset.id), token)
  }
  return fileUrl
}

export function appendPlaybackAccessToken (url: string, token: string | null | undefined): string {
  const u = url.trim()
  if (!u || !token?.trim()) return u
  if (/[?&]access_token=/.test(u)) return u
  if (!isProjectAssetMediaPath(u)) return u
  const join = u.includes('?') ? '&' : '?'
  return `${u}${join}access_token=${encodeURIComponent(token.trim())}`
}
