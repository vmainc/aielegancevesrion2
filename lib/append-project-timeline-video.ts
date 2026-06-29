import {
  appendClipsToDocument,
  type TimelineClipAppendInput
} from '~/lib/timeline-editor/append-to-document'
import {
  loadTimelineFromStorage,
  saveTimelineToStorage
} from '~/lib/timeline-editor/storage'
import { projectTimelineDocumentToEditorDocument } from '~/lib/project-timeline-normalize'
import {
  appendClipsToCloudTimeline,
  type TimelineAppendOutcome,
  type TimelineAppendResult
} from '~/lib/timeline-append-feedback'
import { DEFAULT_ZOOM_PX_PER_SEC } from '~/types/timeline-editor'
import type { ProjectTimelineDocument } from '~/types/project-timeline'

export type ProjectTimelineVideoAppend = {
  url: string
  label: string
  sceneId?: string
  shotId?: string
  assetId?: string
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

function toVideoClipInput (clip: ProjectTimelineVideoAppend): TimelineClipAppendInput {
  return {
    type: 'video',
    label: clip.label,
    src: clip.url,
    assetId: clip.assetId,
    sceneId: clip.sceneId,
    shotId: clip.shotId,
    id: clip.id,
    duration: clip.duration
  }
}

function appendVideoToLocalStorage (projectId: string, clip: ProjectTimelineVideoAppend): string {
  const pid = projectId.trim()
  const doc = loadTimelineFromStorage(pid)
  let clips = doc?.clips ?? []
  const zoom = doc?.zoom ?? DEFAULT_ZOOM_PX_PER_SEC
  const { clips: next, appendedClipIds } = appendClipsToDocument(clips, [toVideoClipInput(clip)])
  if (!appendedClipIds.length) {
    return clip.id?.trim() || ''
  }
  saveTimelineToStorage(pid, next, zoom)
  return appendedClipIds[0]
}

function syncLocalFromCloudDocument (projectId: string, cloudDocument: ProjectTimelineDocument): void {
  const editorDoc = projectTimelineDocumentToEditorDocument(cloudDocument)
  saveTimelineToStorage(projectId, editorDoc.clips, editorDoc.zoom)
}

/**
 * Append a generated (or library) video to the project timeline — cloud first, local backup.
 */
export async function appendVideoToProjectTimeline (
  projectId: string,
  clip: ProjectTimelineVideoAppend,
  opts?: { authHeaders?: Record<string, string> }
): Promise<TimelineAppendResult> {
  if (!import.meta.client) {
    return { clipId: '', outcome: 'unavailable' }
  }
  const pid = projectId.trim()
  const url = clip.url.trim()
  if (!pid || !url) {
    return { clipId: '', outcome: 'unavailable' }
  }

  const input = toVideoClipInput(clip)
  let outcome: TimelineAppendOutcome = 'unavailable'
  let cloudError: string | undefined
  let clipId = clip.id?.trim() || ''

  const hasAuth = Boolean(opts?.authHeaders && Object.keys(opts.authHeaders).length)

  if (hasAuth) {
    const cloud = await appendClipsToCloudTimeline(pid, [input], opts!.authHeaders!)
    if (cloud.ok) {
      outcome = 'cloud'
      clipId = cloud.data.appendedClipIds[0] || clipId
      syncLocalFromCloudDocument(pid, cloud.data.timeline.document)
    } else {
      cloudError = cloud.error
      outcome = cloud.statusCode === 503 ? 'unavailable' : 'local_only'
      clipId = appendVideoToLocalStorage(pid, clip) || clipId
    }
  } else {
    clipId = appendVideoToLocalStorage(pid, clip) || clipId
  }

  if (clipId) {
    const pushed = useTimelineClipPushedState()
    pushed.value = { projectId: pid, clipId }
  }

  return { clipId, outcome, cloudError }
}
