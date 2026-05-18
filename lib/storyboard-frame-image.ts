/** Storyboard still-frame helpers (client). */

import { blobToDataUrl, maybeCompressImageBlob } from '~/lib/image-blob-client'

export const SINGLE_STORYBOARD_FRAME_DIRECTIVE =
  'ONE IMAGE ONLY: a single cinematic storyboard still for this panel — not a comic strip, not a diptych, not split screen, not stacked panels, not before/after, not a collage of multiple scenes.'

export type ProjectAspectRatio = '16:9' | '9:16' | '1:1'

export function normalizeProjectAspectRatio (aspectRatio?: string): ProjectAspectRatio {
  if (aspectRatio === '9:16' || aspectRatio === '1:1' || aspectRatio === '16:9') {
    return aspectRatio
  }
  return '16:9'
}

export function parseProjectAspectRatio (aspectRatio: string): { w: number; h: number } {
  const ar = normalizeProjectAspectRatio(aspectRatio)
  if (ar === '9:16') return { w: 9, h: 16 }
  if (ar === '1:1') return { w: 1, h: 1 }
  return { w: 16, h: 9 }
}

/** Tailwind classes for storyboard / video frame preview boxes. */
export function storyboardFramePreviewClasses (aspectRatio?: string): string {
  const ar = normalizeProjectAspectRatio(aspectRatio)
  const base =
    'relative w-full rounded-lg border border-gray-200 overflow-hidden bg-gray-900'
  if (ar === '9:16') {
    return `${base} aspect-[9/16] max-w-[min(100%,300px)] mx-auto`
  }
  if (ar === '1:1') {
    return `${base} aspect-square max-w-md mx-auto`
  }
  return `${base} aspect-video`
}

export function openRouterImageAspectRatio (aspectRatio?: string): ProjectAspectRatio {
  return normalizeProjectAspectRatio(aspectRatio)
}

function loadImageFromDataUrl (dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = dataUrl
  })
}

function canvasToDataUrl (canvas: HTMLCanvasElement, type: string, quality: number): string {
  return canvas.toDataURL(type, quality)
}

/**
 * Some image models return a vertical stack of two widescreen panels. Crop to project aspect for preview + upload.
 */
export async function normalizeStoryboardFrameImageUrl (
  imageUrl: string,
  aspectRatio: string
): Promise<string> {
  if (!import.meta.client || !imageUrl.trim()) return imageUrl

  const { w, h } = parseProjectAspectRatio(aspectRatio)
  const targetAspect = w / h

  let dataUrl = imageUrl.trim()
  if (!dataUrl.startsWith('data:image/')) {
    try {
      const res = await fetch(dataUrl)
      if (!res.ok) return imageUrl
      const blob = await res.blob()
      dataUrl = await blobToDataUrl(blob)
    } catch {
      return imageUrl
    }
  }

  let img: HTMLImageElement
  try {
    img = await loadImageFromDataUrl(dataUrl)
  } catch {
    return imageUrl
  }

  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return imageUrl

  const imgAspect = iw / ih
  const tolerance = 0.12

  if (Math.abs(imgAspect - targetAspect) <= tolerance) {
    return dataUrl
  }

  const portraitImage = imgAspect < 1
  const landscapeTarget = targetAspect > 1.15
  const landscapeImage = imgAspect > 1
  const portraitTarget = targetAspect < 0.9

  // Portrait still on a landscape project (or vice versa): keep full frame; UI uses object-contain.
  if ((portraitImage && landscapeTarget) || (landscapeImage && portraitTarget)) {
    return dataUrl
  }

  // Very tall composite (stacked panels): crop to target aspect from vertical center.
  const stackedComposite = imgAspect < targetAspect * 0.55
  if (!stackedComposite) {
    return dataUrl
  }

  let cropW = iw
  let cropH = ih
  let sx = 0
  let sy = 0

  if (imgAspect < targetAspect - tolerance) {
    cropH = Math.round(iw / targetAspect)
    cropH = Math.min(cropH, ih)
    sy = Math.round((ih - cropH) / 2)
  } else if (imgAspect > targetAspect + tolerance) {
    cropW = Math.round(ih * targetAspect)
    cropW = Math.min(cropW, iw)
    sx = Math.round((iw - cropW) / 2)
  } else {
    return dataUrl
  }

  const canvas = document.createElement('canvas')
  canvas.width = cropW
  canvas.height = cropH
  const ctx = canvas.getContext('2d')
  if (!ctx) return imageUrl
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH)

  const out = canvasToDataUrl(canvas, 'image/jpeg', 0.92)
  const blob = await (await fetch(out)).blob()
  const compressed = await maybeCompressImageBlob(blob)
  return blobToDataUrl(compressed)
}
