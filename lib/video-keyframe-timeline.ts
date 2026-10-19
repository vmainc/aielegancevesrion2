/** Shot-guide keyframes on the video generation timeline (Higgsfield-style). */

export type VideoTimelineKeyframe = {
  id: string
  /** Seconds from clip start. Clamped to [0, duration]. */
  atSeconds: number
  imageUrl?: string | null
  /** Short beat note — what should be happening at this moment. */
  note?: string
}

function newId (): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `kf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function clampKeyframeSeconds (at: number, durationSeconds: number): number {
  const dur = Math.max(1, Math.floor(Number(durationSeconds) || 1))
  const n = Number(at)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(dur, Math.round(n * 10) / 10))
}

/** Default start (0s) + end (duration) slots. */
export function createDefaultTimelineKeyframes (durationSeconds: number): VideoTimelineKeyframe[] {
  const dur = Math.max(1, Math.floor(Number(durationSeconds) || 5))
  return [
    { id: newId(), atSeconds: 0, imageUrl: null, note: '' },
    { id: newId(), atSeconds: dur, imageUrl: null, note: '' }
  ]
}

export function sortTimelineKeyframes (frames: VideoTimelineKeyframe[]): VideoTimelineKeyframe[] {
  return [...frames].sort((a, b) => a.atSeconds - b.atSeconds || a.id.localeCompare(b.id))
}

/** Keep end slot pinned when duration changes; clamp everything else. */
export function rescaleTimelineKeyframes (
  frames: VideoTimelineKeyframe[],
  prevDuration: number,
  nextDuration: number
): VideoTimelineKeyframe[] {
  const prev = Math.max(1, Math.floor(Number(prevDuration) || 1))
  const next = Math.max(1, Math.floor(Number(nextDuration) || 1))
  if (prev === next) return frames
  return sortTimelineKeyframes(
    frames.map((f) => {
      const wasAtEnd = Math.abs(f.atSeconds - prev) < 0.05
      if (wasAtEnd) {
        return { ...f, atSeconds: next }
      }
      const ratio = prev > 0 ? f.atSeconds / prev : 0
      return { ...f, atSeconds: clampKeyframeSeconds(ratio * next, next) }
    })
  )
}

export function seedTimelineFromStartEnd (opts: {
  durationSeconds: number
  startFrameUrl?: string | null
  endFrameUrl?: string | null
}): VideoTimelineKeyframe[] {
  const dur = Math.max(1, Math.floor(Number(opts.durationSeconds) || 5))
  const start = (opts.startFrameUrl || '').trim() || null
  const end = (opts.endFrameUrl || '').trim() || null
  return [
    { id: newId(), atSeconds: 0, imageUrl: start, note: '' },
    { id: newId(), atSeconds: dur, imageUrl: end, note: '' }
  ]
}

export function deriveStartEndFromTimeline (frames: VideoTimelineKeyframe[]): {
  startFrameUrl: string | null
  endFrameUrl: string | null
} {
  const sorted = sortTimelineKeyframes(frames)
  if (!sorted.length) {
    return { startFrameUrl: null, endFrameUrl: null }
  }
  const dur = Math.max(
    ...sorted.map(f => f.atSeconds),
    1
  )
  const startSlot = sorted.find(f => f.atSeconds <= 0.05) || sorted[0]
  const endSlot =
    sorted.find(f => Math.abs(f.atSeconds - dur) < 0.05) ||
    sorted[sorted.length - 1]
  const start = (startSlot?.imageUrl || '').trim() || null
  const end = (endSlot?.imageUrl || '').trim() || null
  return {
    startFrameUrl: start,
    endFrameUrl: end && end !== start ? end : null
  }
}

/**
 * Mid keyframe image URLs — retained for callers, but the UI no longer attaches
 * mid stills (most models only lock start/end). Prefer empty in new sessions.
 */
export function middleTimelineKeyframeUrls (frames: VideoTimelineKeyframe[]): string[] {
  const sorted = sortTimelineKeyframes(frames)
  if (sorted.length <= 2) return []
  const dur = Math.max(...sorted.map(f => f.atSeconds), 1)
  return sorted
    .filter((f) => {
      if (f.atSeconds <= 0.05) return false
      if (Math.abs(f.atSeconds - dur) < 0.05) return false
      return Boolean((f.imageUrl || '').trim())
    })
    .map(f => f.imageUrl!.trim())
}

export function formatKeyframeTimeLabel (atSeconds: number, durationSeconds: number): string {
  const at = clampKeyframeSeconds(atSeconds, durationSeconds)
  const dur = Math.max(1, Math.floor(Number(durationSeconds) || 1))
  if (at <= 0.05) return 'Start · 0s'
  if (Math.abs(at - dur) < 0.05) return `End · ${dur}s`
  const rounded = Number.isInteger(at) ? String(at) : at.toFixed(1)
  return `${rounded}s`
}

/**
 * Append timed beat guidance so models stay on track between start/end frames.
 * Start/end stills are real image locks when the model supports them.
 * Mid beats are text cues only — never claim a mid still is attached to the render.
 */
export function appendKeyframeTimelineGuidance (
  prompt: string,
  frames: VideoTimelineKeyframe[],
  durationSeconds: number
): string {
  const base = prompt.trim()
  const dur = Math.max(1, Math.floor(Number(durationSeconds) || 1))
  const sorted = sortTimelineKeyframes(frames)
  const lines: string[] = []

  for (const f of sorted) {
    const t = clampKeyframeSeconds(f.atSeconds, dur)
    const isStart = t <= 0.05
    const isEnd = Math.abs(t - dur) < 0.05
    const note = (f.note || '').trim()
    const hasImage = Boolean((f.imageUrl || '').trim())
    const label = formatKeyframeTimeLabel(t, dur)

    if (isStart || isEnd) {
      if (!hasImage && !note) continue
      const parts: string[] = []
      if (hasImage) {
        parts.push(isStart ? 'hold the start-frame still' : 'land on the end-frame still')
      }
      if (note) parts.push(note)
      lines.push(`- ${label}: ${parts.join(' — ')}`)
      continue
    }

    // Mid beats: text only
    if (!note) continue
    lines.push(`- ${label}: ${note}`)
  }

  if (!lines.length) return base

  const block = [
    'SHOT TIMELINE (hit these beats in order; interpolate smoothly between them — do not jump-cut):',
    ...lines,
    `Total duration: ${dur}s.`
  ].join('\n')

  if (base.includes('SHOT TIMELINE (hit these beats')) {
    return base.replace(/SHOT TIMELINE \(hit these beats[\s\S]*?(?=\n\n[A-Z]|\s*$)/, block).trim()
  }
  return base ? `${base}\n\n${block}` : block
}

export function addTimelineKeyframe (
  frames: VideoTimelineKeyframe[],
  durationSeconds: number,
  atSeconds?: number
): VideoTimelineKeyframe[] {
  const dur = Math.max(1, Math.floor(Number(durationSeconds) || 1))
  const sorted = sortTimelineKeyframes(frames)
  let at = typeof atSeconds === 'number' ? atSeconds : dur / 2
  if (typeof atSeconds !== 'number' && sorted.length >= 2) {
    // Place in the largest gap.
    let bestAt = dur / 2
    let bestGap = 0
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].atSeconds - sorted[i].atSeconds
      if (gap > bestGap) {
        bestGap = gap
        bestAt = sorted[i].atSeconds + gap / 2
      }
    }
    at = bestAt
  }
  const next: VideoTimelineKeyframe = {
    id: newId(),
    atSeconds: clampKeyframeSeconds(at, dur),
    imageUrl: null,
    note: ''
  }
  return sortTimelineKeyframes([...frames, next])
}

export function removeTimelineKeyframe (
  frames: VideoTimelineKeyframe[],
  id: string
): VideoTimelineKeyframe[] {
  if (frames.length <= 2) return frames
  const next = frames.filter(f => f.id !== id)
  return next.length >= 2 ? next : frames
}

export function updateTimelineKeyframe (
  frames: VideoTimelineKeyframe[],
  id: string,
  patch: Partial<Pick<VideoTimelineKeyframe, 'atSeconds' | 'imageUrl' | 'note'>>,
  durationSeconds: number
): VideoTimelineKeyframe[] {
  return sortTimelineKeyframes(
    frames.map((f) => {
      if (f.id !== id) return f
      return {
        ...f,
        ...patch,
        atSeconds:
          patch.atSeconds != null
            ? clampKeyframeSeconds(patch.atSeconds, durationSeconds)
            : f.atSeconds
      }
    })
  )
}
