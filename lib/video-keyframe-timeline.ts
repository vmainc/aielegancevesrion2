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
  const withImages = sortTimelineKeyframes(frames).filter(f => (f.imageUrl || '').trim())
  if (!withImages.length) {
    return { startFrameUrl: null, endFrameUrl: null }
  }
  const start = withImages[0].imageUrl!.trim()
  const end = withImages[withImages.length - 1].imageUrl!.trim()
  return {
    startFrameUrl: start,
    endFrameUrl: end !== start ? end : null
  }
}

/** Mid keyframes (not first/last image anchors) — guidance refs + prompt beats. */
export function middleTimelineKeyframeUrls (frames: VideoTimelineKeyframe[]): string[] {
  const withImages = sortTimelineKeyframes(frames).filter(f => (f.imageUrl || '').trim())
  if (withImages.length <= 2) return []
  return withImages.slice(1, -1).map(f => f.imageUrl!.trim()).filter(Boolean)
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
 * Image-bearing beats are noted as visual anchors; notes are included when present.
 */
export function appendKeyframeTimelineGuidance (
  prompt: string,
  frames: VideoTimelineKeyframe[],
  durationSeconds: number
): string {
  const base = prompt.trim()
  const sorted = sortTimelineKeyframes(frames).filter(
    f => (f.imageUrl || '').trim() || (f.note || '').trim()
  )
  if (sorted.length < 1) return base

  const dur = Math.max(1, Math.floor(Number(durationSeconds) || 1))
  const lines = sorted.map((f) => {
    const t = clampKeyframeSeconds(f.atSeconds, dur)
    const label = formatKeyframeTimeLabel(t, dur)
    const parts: string[] = []
    if ((f.imageUrl || '').trim()) parts.push('match the attached still for this beat')
    if ((f.note || '').trim()) parts.push(f.note!.trim())
    return `- ${label}: ${parts.join(' — ') || 'hold composition continuity'}`
  })

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
