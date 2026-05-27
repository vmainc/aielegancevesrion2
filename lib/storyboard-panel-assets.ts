import type { CreativeShot } from '~/types/creative-shot'
import type { ProjectAsset } from '~/types/project-asset'

function assetSceneId (asset: ProjectAsset): string {
  const meta = asset.metadata || {}
  return typeof meta.scene_id === 'string' ? meta.scene_id.trim() : ''
}

function assetShotId (asset: ProjectAsset): string {
  const meta = asset.metadata || {}
  return typeof meta.shot_id === 'string' ? meta.shot_id.trim() : ''
}

function assetSortOrder (asset: ProjectAsset): number | null {
  const meta = asset.metadata || {}
  const n = Number(meta.sort_order)
  return Number.isFinite(n) ? n : null
}

function assetPanelIndexMeta (asset: ProjectAsset): number | null {
  const meta = asset.metadata || {}
  const n = Number(meta.panel_index)
  return Number.isFinite(n) ? Math.floor(n) : null
}

function assetTimestamp (asset: ProjectAsset): string {
  return String(asset.updated || asset.created || '')
}

function assetIsNewer (a: ProjectAsset, b: ProjectAsset): boolean {
  return assetTimestamp(a).localeCompare(assetTimestamp(b)) > 0
}

/** Metadata written when saving a storyboard frame for a panel. */
export function storyboardFrameMetadata (
  shot: CreativeShot,
  sceneId: string,
  panelIndex: number,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    scene_id: sceneId,
    shot_id: (shot.id || '').trim(),
    panel_index: panelIndex,
    sort_order: shot.sortOrder,
    ...extra
  }
}

function strictTitleMatchesShot (asset: ProjectAsset, shot: CreativeShot): boolean {
  const shotTitle = (shot.title || '').trim().toLowerCase()
  if (!shotTitle) return false
  const assetTitle = (asset.title || '').trim().toLowerCase()
  return (
    assetTitle === shotTitle ||
    assetTitle.startsWith(`${shotTitle} (`) ||
    assetTitle.startsWith(`${shotTitle} -`)
  )
}

/** Whether this asset can be considered for the given scene. */
export function assetBelongsToScene (
  asset: ProjectAsset,
  sceneId: string,
  shots: CreativeShot[]
): boolean {
  if (!asset.id) return false
  const sc = assetSceneId(asset)
  if (sc && sc !== sceneId) return false
  if (sc === sceneId) return true
  const shotId = assetShotId(asset)
  if (shotId && shots.some(s => s.id === shotId)) return true
  if (resolveAssetPanelIndex(shots, asset) !== null) return true
  return false
}

/**
 * 0-based panel index for this asset within the scene shot list.
 */
export function resolveAssetPanelIndex (
  shots: CreativeShot[],
  asset: ProjectAsset
): number | null {
  if (!shots.length) return null

  const fromMeta = assetPanelIndexMeta(asset)
  if (fromMeta !== null && fromMeta >= 0 && fromMeta < shots.length) {
    return fromMeta
  }

  const sortMeta = assetSortOrder(asset)
  if (sortMeta === null) return null

  const byShotSort = shots.findIndex(s => s.sortOrder === sortMeta)
  if (byShotSort >= 0) return byShotSort

  if (sortMeta >= 1 && sortMeta <= shots.length) {
    return sortMeta - 1
  }

  if (sortMeta >= 0 && sortMeta < shots.length) {
    return sortMeta
  }

  return null
}

/** Whether an asset targets this shot in this scene (for single-shot lookups). */
export function storyboardAssetMatchesShot (
  asset: ProjectAsset,
  shot: CreativeShot,
  sceneId: string,
  panelIndex: number,
  shotsInScene: CreativeShot[]
): boolean {
  if (!assetBelongsToScene(asset, sceneId, shotsInScene)) return false

  const shotId = assetShotId(asset)
  if (shotId && shotId === shot.id) return true

  const pi = resolveAssetPanelIndex(shotsInScene, asset)
  if (pi === panelIndex) return true

  const sortMeta = assetSortOrder(asset)
  if (sortMeta !== null && sortMeta === shot.sortOrder) return true

  return strictTitleMatchesShot(asset, shot)
}

function assignAssetToShot (
  map: Map<string, ProjectAsset>,
  usedAssetIds: Set<string>,
  shot: CreativeShot,
  asset: ProjectAsset
) {
  const existing = map.get(shot.id)
  if (existing && existing.id !== asset.id) {
    if (!assetIsNewer(asset, existing)) return
    usedAssetIds.delete(existing.id)
  }
  map.set(shot.id, asset)
  usedAssetIds.add(asset.id)
}

function sortAssetsByPanelOrder (shots: CreativeShot[], assets: ProjectAsset[]): ProjectAsset[] {
  return [...assets].sort((a, b) => {
    const pa = resolveAssetPanelIndex(shots, a)
    const pb = resolveAssetPanelIndex(shots, b)
    if (pa !== null && pb !== null && pa !== pb) return pa - pb
    if (pa !== null && pb === null) return -1
    if (pa === null && pb !== null) return 1
    return assetTimestamp(a).localeCompare(assetTimestamp(b))
  })
}

/**
 * Map each shot in a scene to its storyboard asset.
 * Priority: shot_id → panel_index / sort_order → strict title → ordered zip fallback.
 */
export function mapStoryboardAssetsToShots (
  shots: CreativeShot[],
  assets: ProjectAsset[],
  sceneId: string
): Map<string, ProjectAsset> {
  const map = new Map<string, ProjectAsset>()
  const usedAssetIds = new Set<string>()

  const sceneAssets = assets
    .filter(a => assetBelongsToScene(a, sceneId, shots))
    .sort((a, b) => assetTimestamp(b).localeCompare(assetTimestamp(a)))

  for (const asset of sceneAssets) {
    const shotId = assetShotId(asset)
    if (!shotId || usedAssetIds.has(asset.id)) continue
    const shot = shots.find(s => s.id === shotId)
    if (!shot) continue
    assignAssetToShot(map, usedAssetIds, shot, asset)
  }

  for (const asset of sceneAssets) {
    if (usedAssetIds.has(asset.id)) continue
    const panelIndex = resolveAssetPanelIndex(shots, asset)
    if (panelIndex === null) continue
    const shot = shots[panelIndex]
    if (!shot) continue
    assignAssetToShot(map, usedAssetIds, shot, asset)
  }

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i]!
    if (map.has(shot.id)) continue
    const matches = sceneAssets.filter(
      a => !usedAssetIds.has(a.id) && strictTitleMatchesShot(a, shot)
    )
    if (!matches.length) continue
    assignAssetToShot(map, usedAssetIds, shot, matches[0]!)
  }

  const unmappedShots = shots.filter(s => !map.has(s.id))
  const unmappedAssets = sortAssetsByPanelOrder(
    shots,
    sceneAssets.filter(a => !usedAssetIds.has(a.id))
  )
  if (
    unmappedShots.length > 0 &&
    unmappedShots.length === unmappedAssets.length
  ) {
    for (let i = 0; i < unmappedShots.length; i++) {
      assignAssetToShot(map, usedAssetIds, unmappedShots[i]!, unmappedAssets[i]!)
    }
  }

  return map
}
