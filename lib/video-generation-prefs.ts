const STORAGE_KEY = 'video_generation_prefs_v1'

export type VideoGenerationAspectRatio = '16:9' | '9:16' | '1:1'

/** Common clip lengths offered in Video tools (per-model snap still applies). */
export const VIDEO_TOOL_CLIP_SECONDS = [5, 10, 15] as const
export type VideoToolClipSeconds = (typeof VIDEO_TOOL_CLIP_SECONDS)[number]

export type VideoGenerationPrefs = {
  primaryModelId?: string
  compareModelIds?: string[]
  projectId?: string
  aspectRatio?: VideoGenerationAspectRatio
  durationSeconds?: number
}

const ASPECT_RATIOS = new Set<VideoGenerationAspectRatio>(['16:9', '9:16', '1:1'])

export function parseVideoGenerationAspectRatio (raw: unknown): VideoGenerationAspectRatio | undefined {
  if (raw === '16:9' || raw === '9:16' || raw === '1:1') return raw
  return undefined
}

export function parseVideoGenerationDurationSeconds (raw: unknown): VideoToolClipSeconds | undefined {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (n === 5 || n === 10 || n === 15) return n
  return undefined
}

export function readVideoGenerationPrefs (): VideoGenerationPrefs {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as VideoGenerationPrefs
    if (!parsed || typeof parsed !== 'object') return {}
    return {
      primaryModelId:
        typeof parsed.primaryModelId === 'string' ? parsed.primaryModelId.trim() : undefined,
      compareModelIds: Array.isArray(parsed.compareModelIds)
        ? parsed.compareModelIds.filter((id): id is string => typeof id === 'string' && !!id.trim())
        : undefined,
      projectId: typeof parsed.projectId === 'string' ? parsed.projectId.trim() : undefined,
      aspectRatio: parseVideoGenerationAspectRatio(parsed.aspectRatio),
      durationSeconds: parseVideoGenerationDurationSeconds(parsed.durationSeconds)
    }
  } catch {
    return {}
  }
}

export function writeVideoGenerationPrefs (prefs: VideoGenerationPrefs): void {
  if (typeof localStorage === 'undefined') return
  const aspectRatio = parseVideoGenerationAspectRatio(prefs.aspectRatio)
  const durationSeconds = parseVideoGenerationDurationSeconds(prefs.durationSeconds)
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...prefs,
        aspectRatio: aspectRatio || undefined,
        durationSeconds: durationSeconds || undefined
      })
    )
  } catch {
    /* quota / private mode */
  }
}

export function defaultAspectRatioFromPrefs (
  bootAspect?: VideoGenerationAspectRatio
): VideoGenerationAspectRatio {
  if (bootAspect && ASPECT_RATIOS.has(bootAspect)) return bootAspect
  if (typeof localStorage !== 'undefined') {
    const fromPrefs = readVideoGenerationPrefs().aspectRatio
    if (fromPrefs) return fromPrefs
  }
  return '16:9'
}

export function defaultDurationFromPrefs (bootDuration?: number): VideoToolClipSeconds {
  const fromBoot = parseVideoGenerationDurationSeconds(bootDuration)
  if (fromBoot) return fromBoot
  if (typeof localStorage !== 'undefined') {
    const fromPrefs = readVideoGenerationPrefs().durationSeconds
    if (fromPrefs) return fromPrefs
  }
  return 5
}

/**
 * Clip-length choices for the Video tools picker.
 * When models report `supported_durations`, only show 5 / 10 / 15 that appear in the union.
 */
export function videoToolDurationOptions (
  selectedModels: Array<{ supportedDurations?: number[] }>
): VideoToolClipSeconds[] {
  const sets = selectedModels
    .map(m => m.supportedDurations)
    .filter((d): d is number[] => Array.isArray(d) && d.length > 0)
  if (!sets.length) return [...VIDEO_TOOL_CLIP_SECONDS]
  const union = new Set(sets.flatMap(s => s.map(n => Math.floor(Number(n)))))
  const opts = VIDEO_TOOL_CLIP_SECONDS.filter(s => union.has(s))
  return opts.length ? opts : [5, 10]
}
