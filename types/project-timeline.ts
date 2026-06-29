import type { TimelineEditorClip, TimelineEditorDocument } from '~/types/timeline-editor'

/** Persisted clip — same as editor clip; optional durable refs added in later passes. */
export type ProjectTimelineClip = TimelineEditorClip & {
  assetId?: string
}

/** Cloud-stored timeline document (editor v2 + optional metadata). */
export interface ProjectTimelineDocument {
  version: 2
  clips: ProjectTimelineClip[]
  zoom: number
  /** ISO timestamp set on cloud save. */
  updatedAt?: string
}

export type ProjectTimelineSource = 'editor' | 'local_import' | 'migration'

export const PROJECT_TIMELINE_SCHEMA_VERSION = 1

export interface ProjectTimeline {
  id: string
  ownerId: string
  projectId: string
  title: string
  schemaVersion: number
  revision: number
  document: ProjectTimelineDocument
  source: ProjectTimelineSource
  importedFromLocal: boolean
  localBackupKey: string
  clipCount: number
  durationSeconds: number
  created: string
  updated: string
}

export type ProjectTimelinePutBody = {
  baseRevision?: number
  document: ProjectTimelineDocument
  title?: string
  importedFromLocal?: boolean
  source?: ProjectTimelineSource
}

export type ProjectTimelineGetResponse = {
  timeline: ProjectTimeline | null
  localStorageKey: string
}

export type ProjectTimelinePutResponse = {
  timeline: ProjectTimeline
}

export type TimelineClipAppendInput = {
  type: 'video' | 'audio'
  label: string
  src?: string
  assetId?: string
  duration?: number
  sceneId?: string
  shotId?: string
  id?: string
}

export type TimelineClipsAppendBody = {
  baseRevision?: number
  clips: TimelineClipAppendInput[]
}

export type TimelineClipsAppendResponse = {
  timeline: ProjectTimeline
  appendedClipIds: string[]
}
