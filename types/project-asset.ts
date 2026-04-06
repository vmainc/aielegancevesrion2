/** PocketBase `project_assets.kind` values. */
export type ProjectAssetKind = 'script' | 'character' | 'storyboard' | 'video' | 'other'

export interface ProjectAsset {
  id: string
  projectId: string
  /** When expanded from list endpoints */
  projectName?: string
  kind: ProjectAssetKind
  title: string
  notes: string
  metadata: Record<string, unknown> | null
  sortOrder: number
  /** Resolved file URL when a file is attached */
  fileUrl: string | null
  created: string
  updated: string
}
