import { blobToDataUrl } from '~/lib/image-blob-client'

/** Load any image URL into a data URL the storyboard `<img>` can always display. */
export async function fetchImageAsDataUrl (
  url: string,
  options?: { headers?: Record<string, string> }
): Promise<string> {
  const u = url.trim()
  if (!u) throw new Error('Empty image URL')
  if (u.startsWith('data:image/')) return u

  const isSameOrigin =
    u.startsWith('/') ||
    (import.meta.client && u.startsWith(window.location.origin))
  const res = await fetch(u, {
    headers: options?.headers,
    credentials: isSameOrigin ? 'include' : 'omit',
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
