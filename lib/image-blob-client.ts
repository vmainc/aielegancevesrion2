/** Client-side image helpers for uploads before API calls. */

export async function blobToDataUrl (blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('Could not read image data'))
    r.readAsDataURL(blob)
  })
}

function loadImageFromDataUrl (dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = dataUrl
  })
}

function canvasToBlob (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
}

export async function maybeCompressImageBlob (blob: Blob, maxBytes = 3_500_000): Promise<Blob> {
  if (!blob.type.startsWith('image/')) return blob
  if (blob.size <= maxBytes) return blob
  const dataUrl = await blobToDataUrl(blob)
  const img = await loadImageFromDataUrl(dataUrl)
  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height
  const maxSide = 1400
  if (Math.max(width, height) > maxSide) {
    const scale = maxSide / Math.max(width, height)
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  ctx.drawImage(img, 0, 0, width, height)
  let quality = 0.86
  let out = await canvasToBlob(canvas, 'image/jpeg', quality)
  while (out && out.size > maxBytes && quality > 0.45) {
    quality -= 0.08
    out = await canvasToBlob(canvas, 'image/jpeg', quality)
  }
  return out || blob
}

export function firstImageUrlFromGenerateResponse (urls: unknown[]): string {
  for (const u of urls) {
    if (typeof u === 'string' && u.trim()) return u.trim()
    if (u && typeof u === 'object' && u !== null && 'url' in u) {
      const url = (u as { url: unknown }).url
      if (typeof url === 'string' && url.trim()) return url.trim()
    }
  }
  return ''
}
