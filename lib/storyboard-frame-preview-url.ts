import { blobToDataUrl } from '~/lib/image-blob-client'
import { isProjectAssetMediaPath, projectAssetMediaPathOnly } from '~/lib/project-asset-playback-url'

/** URLs the storyboard can set on `<img src>` without a client fetch (same-origin / tokenized media). */
export function isDirectStoryboardFrameSrc (url: string): boolean {
  const u = url.trim()
  if (!u) return false
  if (u.startsWith('/pb/')) return true
  if (isProjectAssetMediaPath(projectAssetMediaPathOnly(u))) return true
  return false
}

/** Load remote or auth-gated images into a data URL when `<img src>` cannot load them directly. */
export async function fetchImageAsDataUrl (
  url: string,
  options?: { headers?: Record<string, string> }
): Promise<string> {
  const u = url.trim()
  if (!u) throw new Error('Empty image URL')
  if (u.startsWith('data:image/')) return u

  const pathOnly = projectAssetMediaPathOnly(u)
  const isSameOrigin =
    u.startsWith('/') ||
    (import.meta.client && u.startsWith(window.location.origin))
  const res = await fetch(u, {
    headers: options?.headers,
    credentials: isSameOrigin || isProjectAssetMediaPath(pathOnly) ? 'include' : 'omit',
    mode: 'cors'
  })
  if (!res.ok) {
    throw new Error(`Could not load image (HTTP ${res.status})`)
  }
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error('Response was not an image')
  }
  return blobToDataUrl(blob)
}
