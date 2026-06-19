import { prepareImageFileForUpload } from '~/lib/image-blob-client'
import { parseVideoStartFrameRef, videoStartFramePublicUrl } from '~/lib/video-start-frame-ref'

export async function uploadVideoStartFrameFile (file: File): Promise<string> {
  const prepared = await prepareImageFileForUpload(file, 900_000)
  const form = new FormData()
  form.append('file', prepared)
  const res = await $fetch<{ url?: string }>('/api/generate/video/start-frame', {
    method: 'POST',
    body: form
  })
  const url = typeof res?.url === 'string' ? res.url.trim() : ''
  if (!url) {
    throw new Error('Could not stage starting frame')
  }
  return url
}

/** Normalize any frame URL to a short staged reference (never inline base64 in video POST). */
export async function ensureVideoStartFrameUrl (frameUrl: string | undefined | null): Promise<string | undefined> {
  const u = (frameUrl || '').trim()
  if (!u) return undefined
  if (parseVideoStartFrameRef(u)) return u

  if (u.startsWith('data:')) {
    const res = await fetch(u)
    const blob = await res.blob()
    const file = new File([blob], 'start-frame.jpg', { type: blob.type || 'image/jpeg' })
    return uploadVideoStartFrameFile(file)
  }

  const staged = await $fetch<{ url?: string }>('/api/generate/video/start-frame-from-url', {
    method: 'POST',
    body: { url: u }
  })
  const out = typeof staged?.url === 'string' ? staged.url.trim() : ''
  if (!out) {
    throw new Error('Could not prepare starting frame for video')
  }
  return out
}

export { videoStartFramePublicUrl }
