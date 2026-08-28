import type { ProjectAsset } from '~/types/project-asset'
import type { RepairCategoryId } from './categories'
import type { RepairMode, VideoRepairProviderId } from './types'

export const VIDEO_REPAIR_ASSET_SOURCE = 'video_repair'
export const VIDEO_ORIGINAL_ASSET_SOURCE = 'video_generation'

export type ShotVideoVersionKind = 'original' | 'repair'

export type ShotVideoVersion = {
  assetId: string
  version: number
  label: string
  kind: ShotVideoVersionKind
  created: string
  isCurrent: boolean
  parentAssetId?: string
  originalAssetId?: string
  repairCategories?: RepairCategoryId[]
  repairMode?: RepairMode
  provider?: VideoRepairProviderId
  model?: string
}

export type VideoRepairAssetMetadata = {
  source: typeof VIDEO_REPAIR_ASSET_SOURCE | string
  scene_id?: string
  shot_id?: string
  character_id?: string
  version?: number
  version_label?: string
  parent_asset_id?: string
  original_asset_id?: string
  is_current?: boolean
  repair_categories?: RepairCategoryId[]
  repair_mode?: RepairMode
  provider?: string
  model?: string
  model_id?: string
  estimated_cost?: number
  actual_cost?: number
  duration_seconds?: number
  [key: string]: unknown
}

export function assetShotId (asset: Pick<ProjectAsset, 'shotId' | 'metadata'>): string {
  if (asset.shotId?.trim()) return asset.shotId.trim()
  const meta = asset.metadata
  return typeof meta?.shot_id === 'string' ? meta.shot_id.trim() : ''
}

export function assetIsVideoRepair (asset: Pick<ProjectAsset, 'metadata'>): boolean {
  const src = typeof asset.metadata?.source === 'string' ? asset.metadata.source.trim() : ''
  return src === VIDEO_REPAIR_ASSET_SOURCE
}

export function assetIsShotVideo (
  asset: Pick<ProjectAsset, 'kind' | 'shotId' | 'metadata'>,
  shotId: string
): boolean {
  if (asset.kind !== 'video') return false
  const sid = shotId.trim()
  if (!sid) return false
  return assetShotId(asset) === sid
}

function metaNumber (v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function readShotVideoVersion (asset: ProjectAsset, currentAssetId?: string): ShotVideoVersion {
  const meta = asset.metadata || {}
  const isRepair = assetIsVideoRepair(asset)
  const versionRaw = metaNumber(meta.version)
  const version = versionRaw && versionRaw > 0 ? Math.floor(versionRaw) : isRepair ? 2 : 1
  const label =
    typeof meta.version_label === 'string' && meta.version_label.trim()
      ? meta.version_label.trim()
      : isRepair
        ? 'Repair'
        : 'Original'
  const currentFlag = meta.is_current === true
  const isCurrent = currentAssetId
    ? asset.id === currentAssetId
    : currentFlag
  return {
    assetId: asset.id,
    version,
    label,
    kind: isRepair ? 'repair' : 'original',
    created: asset.created || asset.updated || '',
    isCurrent,
    parentAssetId: typeof meta.parent_asset_id === 'string' ? meta.parent_asset_id.trim() || undefined : undefined,
    originalAssetId: typeof meta.original_asset_id === 'string' ? meta.original_asset_id.trim() || undefined : undefined,
    repairCategories: Array.isArray(meta.repair_categories)
      ? (meta.repair_categories.filter(x => typeof x === 'string') as RepairCategoryId[])
      : undefined,
    repairMode: typeof meta.repair_mode === 'string' ? (meta.repair_mode as RepairMode) : undefined,
    provider: typeof meta.provider === 'string' ? (meta.provider as VideoRepairProviderId) : undefined,
    model:
      (typeof meta.model === 'string' && meta.model.trim()) ||
      (typeof meta.model_id === 'string' && meta.model_id.trim()) ||
      undefined
  }
}

/** Next version number for a shot — never overwrites v1. */
export function nextShotVideoVersionNumber (assets: ProjectAsset[], shotId: string): number {
  const related = assets.filter(a => assetIsShotVideo(a, shotId))
  let max = 1
  for (const a of related) {
    const v = readShotVideoVersion(a).version
    if (v > max) max = v
  }
  return related.length ? max + 1 : 2
}

export function sortShotVideoVersions (versions: ShotVideoVersion[]): ShotVideoVersion[] {
  return [...versions].sort((a, b) => {
    if (a.version !== b.version) return a.version - b.version
    return String(a.created).localeCompare(String(b.created))
  })
}

export function listShotVideoVersions (
  assets: ProjectAsset[],
  shotId: string,
  currentAssetId?: string
): ShotVideoVersion[] {
  const related = assets.filter(a => assetIsShotVideo(a, shotId))
  const flagged = related.find(a => a.metadata?.is_current === true)
  const current = currentAssetId || flagged?.id
  return sortShotVideoVersions(related.map(a => readShotVideoVersion(a, current)))
}

export function formatShotVersionLine (shotSortOrder: number, version: ShotVideoVersion): string {
  const n = Number.isFinite(shotSortOrder) ? Math.max(1, Math.floor(shotSortOrder)) : 1
  return `SHOT ${n}  v${version.version} ${version.label}`
}
