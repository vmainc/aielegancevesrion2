import {
  clipsOnTrack,
  createVideoClipFromUrl,
  normalizeTrackLayout
} from '~/lib/timeline-editor/clip-ops'
import { exportLegacyFromEditor, parseEditorDocument } from '~/lib/timeline-editor/migrate'
import {
  DEFAULT_ZOOM_PX_PER_SEC,
  type TimelineEditorClip
} from '~/types/timeline-editor'

const EDITOR_KEY = 'aie_timeline_editor_v2_'
const LEGACY_KEY = 'aie_timeline_v1_'

export type ProjectTimelineVideoAppend = {
  url: string
  label: string
  sceneId?: string
  shotId?: string
  id?: string
  duration?: number
}

/** Bumped when a clip is appended outside the timeline editor (e.g. video generation). */
export type TimelineClipPushedEvent = {
  projectId: string
  clipId: string
}

export function useTimelineClipPushedState () {
  return useState<TimelineClipPushedEvent | null>('aie_timeline_clip_pushed', () => null)
}

function newClipId (): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

function writeLegacyV1 (
  projectId: string,
  clip: ProjectTimelineVideoAppend,
  clipId: string
): void {
  const legacyKey = `${LEGACY_KEY}${projectId}`
  type LegacyRow = {
    id: string
    label: string
    url: string
    scene_id?: string
    shot_id?: string
  }
  let video: LegacyRow[] = []
  let audio: LegacyRow[] = []
  try {
    const raw = localStorage.getItem(legacyKey)
    if (raw) {
      const j = JSON.parse(raw) as { video?: LegacyRow[]; audio?: LegacyRow[] }
      video = Array.isArray(j.video) ? j.video : []
      audio = Array.isArray(j.audio) ? j.audio : []
    }
  } catch {
    /* start fresh */
  }
  if (video.some(v => v.id === clipId)) return
  video.push({
    id: clipId,
    label: clip.label.slice(0, 500),
    url: clip.url.trim(),
    ...(clip.sceneId ? { scene_id: clip.sceneId } : {}),
    ...(clip.shotId ? { shot_id: clip.shotId } : {})
  })
  localStorage.setItem(
    legacyKey,
    JSON.stringify({
      video,
      audio
    })
  )
}

function writeEditorV2 (
  projectId: string,
  clip: ProjectTimelineVideoAppend,
  clipId: string
): TimelineEditorClip[] {
  const editorKey = `${EDITOR_KEY}${projectId}`
  const parsed = parseEditorDocument(localStorage.getItem(editorKey))
  let clips: TimelineEditorClip[] = parsed?.clips ?? []
  const zoom = parsed?.zoom ?? DEFAULT_ZOOM_PX_PER_SEC

  if (!clips.some(c => c.id === clipId)) {
    const end = clipsOnTrack(clips, 'video').reduce(
      (m, c) => Math.max(m, c.timelineStart + c.duration),
      0
    )
    const created = createVideoClipFromUrl({
      id: clipId,
      src: clip.url.trim(),
      label: clip.label,
      timelineStart: end,
      duration: clip.duration,
      sceneId: clip.sceneId,
      shotId: clip.shotId
    })
    clips = normalizeTrackLayout([...clips, created], 'video')
  }

  localStorage.setItem(editorKey, JSON.stringify({ version: 2, clips, zoom }))

  const legacyKey = `${LEGACY_KEY}${projectId}`
  const legacy = exportLegacyFromEditor(clips)
  localStorage.setItem(
    legacyKey,
    JSON.stringify({
      video: legacy.video.map(v => ({
        id: v.id,
        label: v.label,
        url: v.url,
        scene_id: v.sceneId,
        shot_id: v.shotId
      })),
      audio: legacy.audio.map(a => ({
        id: a.id,
        label: a.label,
        url: a.url
      }))
    })
  )

  return clips
}

/**
 * Append a generated (or library) video to the project timeline.
 * Updates both v1 legacy and v2 editor storage so the timeline editor shows the clip immediately.
 */
export function appendVideoToProjectTimeline (
  projectId: string,
  clip: ProjectTimelineVideoAppend
): string {
  if (!import.meta.client) return ''
  const pid = projectId.trim()
  const url = clip.url.trim()
  if (!pid || !url) return ''

  const clipId = clip.id?.trim() || newClipId()
  writeLegacyV1(pid, clip, clipId)
  writeEditorV2(pid, clip, clipId)

  const pushed = useTimelineClipPushedState()
  pushed.value = { projectId: pid, clipId }

  return clipId
}
