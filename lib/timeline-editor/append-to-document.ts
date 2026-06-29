import {
  clipsOnTrack,
  createLinkedVideoAudioClipsFromUrl,
  newTimelineClipId,
  normalizeTrackLayout
} from '~/lib/timeline-editor/clip-ops'
import type { TimelineEditorClip } from '~/types/timeline-editor'
import type { ProjectTimelineClip } from '~/types/project-timeline'

import type { TimelineClipAppendInput } from '~/types/project-timeline'

export type { TimelineClipAppendInput }

function withAssetId (clip: TimelineEditorClip, assetId?: string): ProjectTimelineClip {
  if (!assetId?.trim()) return clip
  return { ...clip, assetId: assetId.trim() }
}

/**
 * Append one or more clips to a clip array (end of matching track).
 * Video inputs create linked video+audio pairs (same as editor handoff).
 */
export function appendClipsToDocument (
  clips: TimelineEditorClip[],
  inputs: TimelineClipAppendInput[]
): { clips: TimelineEditorClip[]; appendedClipIds: string[] } {
  let next = [...clips]
  const appendedClipIds: string[] = []

  for (const input of inputs) {
    const label = (input.label || 'Clip').slice(0, 500)
    const src = (input.src || '').trim()
    if (!src && !input.assetId?.trim()) continue

    const clipId = input.id?.trim() || newTimelineClipId()
    if (next.some((c) => c.id === clipId)) continue

    if (input.type === 'video') {
      const end = clipsOnTrack(next, 'video').reduce(
        (m, c) => Math.max(m, c.timelineStart + c.duration),
        0
      )
      const linked = createLinkedVideoAudioClipsFromUrl({
        videoId: clipId,
        src: src || '',
        label,
        timelineStart: end,
        duration: input.duration,
        sceneId: input.sceneId,
        shotId: input.shotId
      })
      const video = withAssetId(linked.video, input.assetId)
      const audio = withAssetId(linked.audio, input.assetId)
      next = normalizeTrackLayout(
        normalizeTrackLayout([...next, video, audio], 'video'),
        'audio'
      )
      appendedClipIds.push(video.id)
      continue
    }

    const duration = typeof input.duration === 'number' && input.duration > 0 ? input.duration : 30
    const end = clipsOnTrack(next, 'audio').reduce(
      (m, c) => Math.max(m, c.timelineStart + c.duration),
      0
    )
    const created = withAssetId(
      {
        id: clipId,
        type: 'audio',
        track: 'audio',
        src: src || '',
        label,
        sourceStart: 0,
        sourceEnd: duration,
        timelineStart: end,
        duration,
        transitionIn: null,
        transitionOut: null
      },
      input.assetId
    )
    next = normalizeTrackLayout([...next, created], 'audio')
    appendedClipIds.push(created.id)
  }

  return { clips: next, appendedClipIds }
}
