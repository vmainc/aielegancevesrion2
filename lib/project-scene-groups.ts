import type { ProjectAsset } from '~/types/project-asset'

/** Group key when clip metadata has no scene_id. */
export const UNASSIGNED_SCENE_KEY = '__unassigned_scene__'

export type ProjectSceneRow = {
  id: string
  heading?: string
  sortOrder?: number
}

export type SceneMeta = { heading: string; sortOrder: number }
export type SceneMetaMap = Map<string, SceneMeta>

export type VideoSceneGroup = {
  key: string
  title: string
  sortOrder: number
  items: ProjectAsset[]
}

export function sceneKeyFromAsset (a: ProjectAsset): string {
  const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
  const sid = typeof meta.scene_id === 'string' ? meta.scene_id.trim() : ''
  return sid || UNASSIGNED_SCENE_KEY
}

export function buildSceneMetaMap (scenes: ProjectSceneRow[]): SceneMetaMap {
  const map: SceneMetaMap = new Map()
  for (const s of scenes) {
    map.set(s.id, {
      heading: (s.heading || '').trim() || 'Scene',
      sortOrder: Number.isFinite(Number(s.sortOrder)) ? Number(s.sortOrder) : 9_999
    })
  }
  return map
}

export function sceneGroupTitle (key: string, sceneMap: SceneMetaMap): string {
  if (key === UNASSIGNED_SCENE_KEY) return 'Unassigned scene'
  const info = sceneMap.get(key)
  if (info?.heading) return info.heading
  return `Scene ${key.slice(0, 8)}`
}

export function sceneGroupSortOrder (key: string, sceneMap: SceneMetaMap): number {
  if (key === UNASSIGNED_SCENE_KEY) return 99_999
  return sceneMap.get(key)?.sortOrder ?? 9_999
}

export function compareVideoSceneGroups (a: VideoSceneGroup, b: VideoSceneGroup): number {
  if (a.key === UNASSIGNED_SCENE_KEY) return 1
  if (b.key === UNASSIGNED_SCENE_KEY) return -1
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.title.localeCompare(b.title)
}

export function buildVideoSceneGroups (
  assets: ProjectAsset[],
  sceneMap: SceneMetaMap,
  sortItems: (list: ProjectAsset[]) => ProjectAsset[] = list => list
): VideoSceneGroup[] {
  const byScene = new Map<string, ProjectAsset[]>()
  for (const a of assets) {
    const key = sceneKeyFromAsset(a)
    const cur = byScene.get(key) || []
    cur.push(a)
    byScene.set(key, cur)
  }
  const out: VideoSceneGroup[] = []
  for (const [key, rows] of byScene.entries()) {
    out.push({
      key,
      title: sceneGroupTitle(key, sceneMap),
      sortOrder: sceneGroupSortOrder(key, sceneMap),
      items: sortItems(rows)
    })
  }
  return out.sort(compareVideoSceneGroups)
}
