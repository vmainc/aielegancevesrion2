import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createError } from 'h3'
import {
  VIDEO_SEED_FRAME_MAX_BYTES,
  VIDEO_SEED_FRAME_MAX_SIDE_PX,
  VIDEO_SEED_FRAME_TOO_LARGE_MESSAGE
} from '~/lib/video-start-frame-limits'

/** Resize + JPEG re-encode so OpenRouter PNG/data URLs fit video seed limits. */
export async function compressImageBufferForVideoSeed (
  input: Buffer,
  maxBytes = VIDEO_SEED_FRAME_MAX_BYTES
): Promise<{ data: Buffer; mime: string }> {
  if (!input.length) {
    throw createError({ statusCode: 400, message: 'Empty image data' })
  }

  let img
  try {
    img = await loadImage(input)
  } catch {
    throw createError({ statusCode: 400, message: 'Could not decode image for video starting frame' })
  }

  let width = img.width
  let height = img.height
  if (Math.max(width, height) > VIDEO_SEED_FRAME_MAX_SIDE_PX) {
    const scale = VIDEO_SEED_FRAME_MAX_SIDE_PX / Math.max(width, height)
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
  }

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  let quality = 86
  let out = canvas.toBuffer('image/jpeg', quality)
  while (out.length > maxBytes && quality > 48) {
    quality -= 8
    out = canvas.toBuffer('image/jpeg', quality)
  }

  if (out.length > maxBytes) {
    throw createError({ statusCode: 413, message: VIDEO_SEED_FRAME_TOO_LARGE_MESSAGE })
  }

  return { data: out, mime: 'image/jpeg' }
}
