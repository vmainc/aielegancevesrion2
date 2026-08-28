export const VIDEO_REPAIR_ALLOWED_MIME = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/mpeg'
] as const

export const VIDEO_REPAIR_ALLOWED_EXT = ['.mp4', '.mov', '.webm', '.m4v', '.mpeg', '.mpg'] as const

export const VIDEO_REPAIR_DEFAULTS = {
  maxDurationSeconds: 30,
  maxUploadMb: 150,
  maxConcurrentJobs: 2,
  defaultProvider: 'openrouter' as const,
  defaultModel: 'runway/aleph-2',
  lumaModel: 'ray-2'
}

export function isAllowedRepairVideoMime (mime: string): boolean {
  const m = mime.trim().toLowerCase().split(';')[0]?.trim() || ''
  if ((VIDEO_REPAIR_ALLOWED_MIME as readonly string[]).includes(m)) return true
  // Some browsers send empty or generic types for .mov
  return m === 'video/quicktime' || m === 'application/octet-stream'
}

export function isAllowedRepairVideoFilename (name: string): boolean {
  const lower = name.trim().toLowerCase()
  return VIDEO_REPAIR_ALLOWED_EXT.some(ext => lower.endsWith(ext))
}

export function mimeFromRepairFilename (name: string): string {
  const lower = name.trim().toLowerCase()
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.mov')) return 'video/quicktime'
  if (lower.endsWith('.m4v')) return 'video/x-m4v'
  if (lower.endsWith('.mpeg') || lower.endsWith('.mpg')) return 'video/mpeg'
  return 'video/mp4'
}

export function formatTimecode (seconds: number): string {
  const s = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const mm = Math.floor(s / 60)
  const ss = s - mm * 60
  const whole = Math.floor(ss)
  const frac = Math.round((ss - whole) * 10)
  const fracClamped = frac === 10 ? 0 : frac
  const wholeAdj = frac === 10 ? whole + 1 : whole
  return `${String(mm).padStart(2, '0')}:${String(wholeAdj).padStart(2, '0')}.${fracClamped}`
}
