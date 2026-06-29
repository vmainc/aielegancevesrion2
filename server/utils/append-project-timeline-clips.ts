import { createError } from 'h3'
import type PocketBase from 'pocketbase'
import { appendClipsToDocument, type TimelineClipAppendInput } from '~/lib/timeline-editor/append-to-document'
import {
  emptyTimelineDocument,
  loadProjectTimelineRow,
  saveProjectTimelineDocument
} from '~/server/utils/project-timeline-store'
import { stripPlaybackTokenFromUrl } from '~/lib/project-timeline-normalize'
import type {
  TimelineClipsAppendBody,
  TimelineClipsAppendResponse,
  ProjectTimeline
} from '~/types/project-timeline'
import type { TimelineClipAppendInput } from '~/lib/timeline-editor/append-to-document'

export function parseTimelineClipAppendInput (raw: unknown): TimelineClipAppendInput | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const type = o.type === 'audio' ? 'audio' : o.type === 'video' ? 'video' : null
  if (!type) return null
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  if (!label) return null
  const src = typeof o.src === 'string' ? stripPlaybackTokenFromUrl(o.src) : ''
  const assetId = typeof o.assetId === 'string' ? o.assetId.trim() : ''
  if (!src && !assetId) return null
  return {
    type,
    label,
    src: src || undefined,
    assetId: assetId || undefined,
    duration: typeof o.duration === 'number' && o.duration > 0 ? o.duration : undefined,
    sceneId: typeof o.sceneId === 'string' ? o.sceneId : undefined,
    shotId: typeof o.shotId === 'string' ? o.shotId : undefined,
    id: typeof o.id === 'string' ? o.id : undefined
  }
}

export async function appendClipsToProjectTimeline (
  pb: PocketBase,
  userId: string,
  projectId: string,
  body: TimelineClipsAppendBody
): Promise<TimelineClipsAppendResponse> {
  const inputs = (Array.isArray(body.clips) ? body.clips : [])
    .map(parseTimelineClipAppendInput)
    .filter((c): c is TimelineClipAppendInput => Boolean(c))

  if (!inputs.length) {
    throw createError({ statusCode: 400, message: 'No valid clips to append' })
  }

  const { timeline: existing } = await loadProjectTimelineRow(pb, userId, projectId)
  const baseRevision =
    typeof body.baseRevision === 'number' && Number.isFinite(body.baseRevision)
      ? body.baseRevision
      : undefined

  if (existing && baseRevision != null && baseRevision !== existing.revision) {
    throw createError({
      statusCode: 409,
      message: 'Timeline was updated elsewhere. Reload and try again.',
      data: { currentRevision: existing.revision, timeline: existing }
    })
  }

  const baseDoc = existing?.document ?? emptyTimelineDocument()
  const { clips, appendedClipIds } = appendClipsToDocument(baseDoc.clips, inputs)

  if (!appendedClipIds.length) {
    throw createError({ statusCode: 400, message: 'Clips already exist on timeline' })
  }

  const document = {
    ...baseDoc,
    clips,
    updatedAt: new Date().toISOString()
  }

  const timeline = await saveProjectTimelineDocument(pb, {
    userId,
    projectId,
    document,
    existing,
    source: 'editor'
  })

  return { timeline, appendedClipIds }
}
