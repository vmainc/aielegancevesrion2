/** Server-staged starting frames for video generation (avoids huge JSON bodies). */
export const VIDEO_START_FRAME_PATH_PREFIX = '/api/generate/video/start-frame/'

export function videoStartFramePublicUrl (id: string): string {
  return `${VIDEO_START_FRAME_PATH_PREFIX}${id}`
}

export function parseVideoStartFrameRef (url: string): string | null {
  const u = url.trim()
  if (!u.startsWith(VIDEO_START_FRAME_PATH_PREFIX)) return null
  const id = u.slice(VIDEO_START_FRAME_PATH_PREFIX.length).split(/[?#]/)[0] || ''
  return /^[a-f0-9]{32}$/i.test(id) ? id : null
}
