export type TimelineExportQualityId = '720p' | '1080p'

export type TimelineExportQualityPreset = {
  id: TimelineExportQualityId
  label: string
  hint: string
  width: number
  height: number
  videoBitsPerSecond: number
  frameRate: number
}

export const TIMELINE_EXPORT_QUALITIES: readonly TimelineExportQualityPreset[] = [
  {
    id: '720p',
    label: '720p',
    hint: 'Standard',
    width: 1280,
    height: 720,
    videoBitsPerSecond: 8_000_000,
    frameRate: 30
  },
  {
    id: '1080p',
    label: '1080p',
    hint: 'High quality · larger file',
    width: 1920,
    height: 1080,
    videoBitsPerSecond: 16_000_000,
    frameRate: 30
  }
] as const

export const DEFAULT_TIMELINE_EXPORT_QUALITY: TimelineExportQualityId = '720p'

const STORAGE_KEY = 'aie_timeline_export_quality'
const QUALITY_IDS = new Set<TimelineExportQualityId>(
  TIMELINE_EXPORT_QUALITIES.map(q => q.id)
)

export function parseTimelineExportQuality (raw: unknown): TimelineExportQualityId | undefined {
  if (raw === '720p' || raw === '1080p') return raw
  if (raw === '480p') return '720p'
  return undefined
}

export function timelineExportQualityPreset (
  id: TimelineExportQualityId | undefined | null
): TimelineExportQualityPreset {
  const parsed = parseTimelineExportQuality(id) ?? DEFAULT_TIMELINE_EXPORT_QUALITY
  return TIMELINE_EXPORT_QUALITIES.find(q => q.id === parsed)!
}

export function readTimelineExportQuality (): TimelineExportQualityId {
  if (typeof localStorage === 'undefined') return DEFAULT_TIMELINE_EXPORT_QUALITY
  try {
    const parsed = parseTimelineExportQuality(localStorage.getItem(STORAGE_KEY))
    return parsed && QUALITY_IDS.has(parsed) ? parsed : DEFAULT_TIMELINE_EXPORT_QUALITY
  } catch {
    return DEFAULT_TIMELINE_EXPORT_QUALITY
  }
}

export function writeTimelineExportQuality (id: TimelineExportQualityId): void {
  if (typeof localStorage === 'undefined') return
  const parsed = parseTimelineExportQuality(id)
  if (!parsed) return
  try {
    localStorage.setItem(STORAGE_KEY, parsed)
  } catch {
    /* quota / private mode */
  }
}
