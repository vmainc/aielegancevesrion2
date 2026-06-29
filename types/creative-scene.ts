/** Canonical server-side row from PocketBase `creative_scenes` — structured screenplay scene. */
export interface CreativeScene {
  id: string
  ownerId: string
  projectId: string
  sortOrder: number
  heading: string
  summary: string
  body: string
  created: string
  updated: string
}

/** Compact shape returned by scene list APIs and consumed by page/sidebar UIs. */
export interface CreativeSceneListItem {
  id: string
  sortOrder: number
  heading: string
  summary: string
  bodyLength: number
  shotCount?: number
}
