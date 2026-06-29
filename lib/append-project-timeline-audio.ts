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
import { useTimelineClipPushedState } from '~/lib/append-project-timeline-video'
import type { ProjectTimelineDocument } from '~/types/project-timeline'

export type ProjectTimelineAudioAppend = {
  url: string
  label: string
  assetId?: string
  id?: string
  duration?: number
}

function toAudioClipInput (clip: ProjectTimelineAudioAppend): TimelineClipAppendInput {
  return {
    type: 'audio',
    label: clip.label,
    src: clip.url,
    assetId: clip.assetId,
    id: clip.id,
    duration: clip.duration
  }
}

function appendAudioToLocalStorage (projectId: string, clip: ProjectTimelineAudioAppend): string {
  const pid = projectId.trim()
  const doc = loadTimelineFromStorage(pid)
  let clips = doc?.clips ?? []
  const zoom = doc?.zoom ?? DEFAULT_ZOOM_PX_PER_SEC
  const { clips: next, appendedClipIds } = appendClipsToDocument(clips, [toAudioClipInput(clip)])
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
 * Append generated (or library) audio to the project timeline — cloud first, local backup.
 */
export async function appendAudioToProjectTimeline (
  projectId: string,
  clip: ProjectTimelineAudioAppend,
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

  const input = toAudioClipInput(clip)
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
      clipId = appendAudioToLocalStorage(pid, clip) || clipId
    }
  } else {
    clipId = appendAudioToLocalStorage(pid, clip) || clipId
  }

  if (clipId) {
    const pushed = useTimelineClipPushedState()
    pushed.value = { projectId: pid, clipId }
  }

  return { clipId, outcome, cloudError }
}
