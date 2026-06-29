import { parseEditorDocument } from '~/lib/timeline-editor/migrate'
import { totalTimelineDuration } from '~/lib/timeline-editor/geometry'
import {
  DEFAULT_ZOOM_PX_PER_SEC,
  type TimelineEditorDocument
} from '~/types/timeline-editor'
import type {
  ProjectTimelineClip,
  ProjectTimelineDocument
} from '~/types/project-timeline'

/** Remove playback access tokens before persisting URLs. */
export function stripPlaybackTokenFromUrl (src: string): string {
  const raw = (src || '').trim()
  if (!raw) return ''
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://local'
    const u = new URL(raw, base)
    u.searchParams.delete('token')
    u.searchParams.delete('access_token')
    const out = u.toString()
    if (out.startsWith('http://local')) {
      return u.pathname + u.search + u.hash
    }
    return out
  } catch {
    return raw.split('?token=')[0].split('&token=')[0]
  }
}

function sanitizeClip (row: Record<string, unknown>): ProjectTimelineClip | null {
  const id = typeof row.id === 'string' ? row.id : ''
  const src = stripPlaybackTokenFromUrl(typeof row.src === 'string' ? row.src : '')
  const assetId = typeof row.assetId === 'string' ? row.assetId.trim() : ''
  if (!id || (!src && !assetId)) return null
  const type = row.type === 'audio' ? 'audio' : 'video'
  const track = row.track === 'audio' ? 'audio' : 'video'
  const sourceStart = Number(row.sourceStart) || 0
  const sourceEnd = Number(row.sourceEnd) || sourceStart + 5
  const duration = Number(row.duration) || Math.max(0.25, sourceEnd - sourceStart)
  return {
    id,
    type,
    track,
    src,
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
    shotId: typeof row.shotId === 'string' ? row.shotId : undefined,
    assetId: typeof row.assetId === 'string' ? row.assetId : undefined
  }
}

/** Parse and sanitize a timeline document from JSON or editor shape. */
export function normalizeProjectTimelineDocument (raw: unknown): ProjectTimelineDocument | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const parsed = parseEditorDocument(raw)
    return parsed ? editorDocumentToProjectTimelineDocument(parsed) : null
  }
  if (typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.version !== 2 || !Array.isArray(o.clips)) return null
  const clips: ProjectTimelineClip[] = []
  for (const r of o.clips) {
    if (!r || typeof r !== 'object') continue
    const clip = sanitizeClip(r as Record<string, unknown>)
    if (clip) clips.push(clip)
  }
  return {
    version: 2,
    clips,
    zoom: typeof o.zoom === 'number' && o.zoom > 8 ? o.zoom : DEFAULT_ZOOM_PX_PER_SEC,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined
  }
}

export function editorDocumentToProjectTimelineDocument (
  doc: TimelineEditorDocument,
  updatedAt?: string
): ProjectTimelineDocument {
  return {
    version: 2,
    clips: doc.clips.map((c) => ({
      ...c,
      src: stripPlaybackTokenFromUrl(c.src)
    })),
    zoom: doc.zoom,
    updatedAt: updatedAt || new Date().toISOString()
  }
}

export function projectTimelineDocumentToEditorDocument (
  doc: ProjectTimelineDocument
): TimelineEditorDocument {
  return {
    version: 2,
    clips: doc.clips,
    zoom: doc.zoom
  }
}

export function timelineDocumentStats (doc: ProjectTimelineDocument): {
  clipCount: number
  videoCount: number
  audioCount: number
  durationSeconds: number
  taggedSceneShotCount: number
} {
  const videoCount = doc.clips.filter((c) => c.track === 'video').length
  const audioCount = doc.clips.filter((c) => c.track === 'audio').length
  const taggedSceneShotCount = doc.clips.filter((c) => c.sceneId || c.shotId).length
  return {
    clipCount: doc.clips.length,
    videoCount,
    audioCount,
    durationSeconds: totalTimelineDuration(doc.clips),
    taggedSceneShotCount
  }
}
