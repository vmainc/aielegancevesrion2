import { DEFAULT_CLIP_DURATION, DEFAULT_ZOOM_PX_PER_SEC, type TimelineEditorClip, type TimelineEditorDocument } from '~/types/timeline-editor'

export function parseEditorDocument (raw: string | null): TimelineEditorDocument | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object') return null
    const o = j as Record<string, unknown>
    if (o.version !== 2 || !Array.isArray(o.clips)) return null
    const clips: TimelineEditorClip[] = []
    for (const r of o.clips) {
      if (!r || typeof r !== 'object') continue
      const row = r as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id : ''
      const src = typeof row.src === 'string' ? row.src : ''
      if (!id || !src.trim()) continue
      const type = row.type === 'audio' ? 'audio' : 'video'
      const track = row.track === 'audio' ? 'audio' : 'video'
      const sourceStart = Number(row.sourceStart) || 0
      const sourceEnd = Number(row.sourceEnd) || sourceStart + DEFAULT_CLIP_DURATION
      const duration = Number(row.duration) || Math.max(0.25, sourceEnd - sourceStart)
      clips.push({
        id,
        type,
        track,
        src: src.trim(),
        label: typeof row.label === 'string' ? row.label.slice(0, 500) : 'Clip',
        sourceStart,
        sourceEnd,
        timelineStart: Number(row.timelineStart) || 0,
        duration,
        hasAudio: row.hasAudio !== false,
        linkedVideoId: typeof row.linkedVideoId === 'string' ? row.linkedVideoId : undefined,
        linkedAudioId: typeof row.linkedAudioId === 'string' ? row.linkedAudioId : undefined,
        transitionIn:
          row.transitionIn === 'crossfade' ||
          row.transitionIn === 'fade-in' ||
          row.transitionIn === 'fade-out'
            ? row.transitionIn
            : null,
        transitionOut:
          row.transitionOut === 'crossfade' ||
          row.transitionOut === 'fade-out' ||
          row.transitionOut === 'fade-in'
            ? row.transitionOut
            : null,
        transitionDurationSec:
          typeof row.transitionDurationSec === 'number' && row.transitionDurationSec > 0
            ? row.transitionDurationSec
            : undefined,
        sceneId: typeof row.sceneId === 'string' ? row.sceneId : undefined,
        shotId: typeof row.shotId === 'string' ? row.shotId : undefined
      })
    }
    return {
      version: 2,
      clips,
      zoom: typeof o.zoom === 'number' && o.zoom > 8 ? o.zoom : DEFAULT_ZOOM_PX_PER_SEC
    }
  } catch {
    return null
  }
}

