/** Non-destructive timeline editor — metadata only; source media URLs unchanged. */

export type TimelineTransitionType = 'crossfade' | 'fade-in' | 'fade-out' | null

export type TimelineEditorTrack = 'video' | 'audio'

export type TimelineEditorTool = 'select' | 'split'

export interface TimelineEditorClip {
  id: string
  type: 'video' | 'audio'
  track: TimelineEditorTrack
  src: string
  label: string
  /** Trim in-point in source media (seconds). */
  sourceStart: number
  /** Trim out-point in source media (seconds). */
  sourceEnd: number
  /** Position on timeline (seconds). */
  timelineStart: number
  /** timeline duration = sourceEnd - sourceStart */
  duration: number
  hasAudio?: boolean
  /** When audio was detached from a video clip. */
  linkedVideoId?: string
  linkedAudioId?: string
  transitionIn: TimelineTransitionType
  transitionOut: TimelineTransitionType
  /** Crossfade / fade overlap length in seconds (default 0.6). */
  transitionDurationSec?: number
  sceneId?: string
  shotId?: string
  /** Durable `project_assets` row when known (PASS 29+). */
  assetId?: string
}

export interface TimelineEditorDocument {
  version: 2
  clips: TimelineEditorClip[]
  zoom: number
}

export const DEFAULT_CLIP_DURATION = 5
export const DEFAULT_ZOOM_PX_PER_SEC = 48
export const MIN_CLIP_DURATION = 0.25
export const SNAP_THRESHOLD_SEC = 0.12
