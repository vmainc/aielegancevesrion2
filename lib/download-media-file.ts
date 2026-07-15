function extensionFromContentType (contentType: string, blobType: string): string {
  const ct = (contentType || blobType || '').toLowerCase()
  if (ct.includes('webm')) return 'webm'
  if (ct.includes('quicktime') || ct.includes('mp4') || ct.includes('mpeg')) return 'mp4'
  return 'mp4'
}

export function sanitizeDownloadFilename (name: string): string {
  const trimmed = name.trim().replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(0, 120)
  return trimmed || 'video'
}

/** Fetch a media URL and save it to the user's device (browser download). */
export async function downloadMediaFile (opts: {
  url: string
  filename?: string
  headers?: Record<string, string>
}): Promise<void> {
  if (!import.meta.client) return
  const res = await fetch(opts.url, {
    headers: opts.headers,
    credentials: 'same-origin'
  })
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const ext = extensionFromContentType(res.headers.get('content-type') || '', blob.type)
  const base = sanitizeDownloadFilename(opts.filename || `video-${new Date().toISOString().slice(0, 10)}`)
  const name = /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.${ext}`
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
}
