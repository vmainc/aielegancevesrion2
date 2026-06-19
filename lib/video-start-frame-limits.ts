/** Max bytes for a video starting frame (nginx-safe; leaves room for JSON fields). */
export const VIDEO_SEED_FRAME_MAX_BYTES = 900_000

export const VIDEO_SEED_FRAME_MAX_SIDE_PX = 1280

export const VIDEO_SEED_FRAME_TOO_LARGE_MESSAGE =
  'This image is too large to use as a video starting frame. Try a faster image model (Flux Klein / Gemini Flash), upload a smaller JPEG, or remove the starting frame.'

/** Prepended to image prompts when generating a still for image-to-video. */
export const VIDEO_SEED_IMAGE_GENERATION_DIRECTIVE =
  'VIDEO START FRAME: one still only, suitable as the first frame of a short video. Keep file size small (under ~1MB); avoid huge uncompressed PNG; max 1280px longest side.'
