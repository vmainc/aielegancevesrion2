import { createCanvas, loadImage } from '@napi-rs/canvas'
import { lookbookFaceCropRect } from '~/lib/video-repair/faceCropLookbook'

/**
 * Crop a lookbook plate to a face/head region and re-encode as JPEG.
 * Used so Aleph keyframes guide eye/identity without importing the full studio sheet.
 */
export async function cropLookbookPlateToFaceJpeg (
  input: Buffer
): Promise<{ data: Buffer; mime: 'image/jpeg' } | null> {
  if (!input?.length) return null
  let img
  try {
    img = await loadImage(input)
  } catch {
    return null
  }
  const width = img.width
  const height = img.height
  if (width < 8 || height < 8) return null

  const rect = lookbookFaceCropRect(width, height)
  const canvas = createCanvas(rect.w, rect.h)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)

  let quality = 88
  let out = canvas.toBuffer('image/jpeg', quality)
  while (out.length > 2_500_000 && quality > 50) {
    quality -= 8
    out = canvas.toBuffer('image/jpeg', quality)
  }
  return { data: out, mime: 'image/jpeg' }
}
