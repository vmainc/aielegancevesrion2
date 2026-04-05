export type ProjectAspectRatio = '16:9' | '9:16' | '1:1'

export type ProjectGoal = 'film' | 'social' | 'commercial' | 'other'

export type ProjectSource = 'local' | 'pocketbase'

/** Creative direction bible for the project (presets + manual edits). */
export interface ProjectDirector {
  name: string
  style: string
  tone: string
  camera_preferences: string
  lighting_style: string
  pacing: string
}

export interface CreativeProject {
  id: string
  name: string
  aspectRatio: ProjectAspectRatio
  goal: ProjectGoal
  synopsis: string
  treatment: string
  conceptNotes: string
  createdAt: string
  updatedAt: string
  /** Present when loaded from PocketBase (script import or API). */
  source?: ProjectSource
  genre?: string
  tone?: string
  themes?: string[]
  director?: ProjectDirector
  /** Free-form continuity notes: traits, events, tone rules (AI can append). */
  continuityMemory?: string
  /** Last continuity check output (plain text for UI). */
  continuityLastIssues?: string
}
