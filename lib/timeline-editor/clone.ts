import type { TimelineEditorClip } from '~/types/timeline-editor'

/** Safe deep clone for timeline clips (avoids structuredClone failures on reactive proxies). */
export function cloneTimelineClips (clips: TimelineEditorClip[]): TimelineEditorClip[] {
  return JSON.parse(JSON.stringify(clips)) as TimelineEditorClip[]
}
