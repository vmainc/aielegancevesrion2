import {
  appendPlaybackAccessToken,
  isProjectAssetMediaPath,
  parseProjectAssetMediaIds,
  projectAssetMediaPath,
  projectAssetMediaPathOnly,
  projectAssetPlaybackSrc
} from '~/lib/project-asset-playback-url'
import { stripPlaybackTokenFromUrl } from '~/lib/project-timeline-normalize'
import type { ProjectAsset } from '~/types/project-asset'
import type { TimelineEditorClip } from '~/types/timeline-editor'

export type TimelineClipMediaReliability =
  | 'cloud_asset'
  | 'url_only'
  | 'local_blob'
  | 'missing'
  | 'recoverable'

export const TIMELINE_MEDIA_RELIABILITY_LABELS: Record<TimelineClipMediaReliability, string> = {
  cloud_asset: 'Cloud asset',
  url_only: 'URL only',
  local_blob: 'Local blob',
  missing: 'Missing media',
  recoverable: 'Recoverable'
}

export const TIMELINE_MEDIA_RELIABILITY_WARNINGS: Partial<Record<TimelineClipMediaReliability, string>> = {
  local_blob: 'This clip uses a browser blob URL. It will not play after you reload or on another device.',
  missing: 'No playback URL. Preview and export will skip this clip until media is repaired or replaced.',
  recoverable: 'Asset ID is set but the stored URL is missing or stale. Playback uses a temporary resolve until you repair.',
  url_only: 'URL-only reference — not linked to a project asset row.'
}

export function isBlobTimelineUrl (src: string): boolean {
  return (src || '').trim().toLowerCase().startsWith('blob:')
}

export function isMissingTimelineClipSrc (src: string | undefined | null): boolean {
  return !(src || '').trim()
}

export function isDurableProjectAssetUrl (src: string): boolean {
  const bare = stripPlaybackTokenFromUrl(src)
  return isProjectAssetMediaPath(projectAssetMediaPathOnly(bare))
}

export function hasAssetIdBackedClip (clip: { assetId?: string }): boolean {
  return Boolean((clip.assetId || '').trim())
}

export function clipEffectiveAssetId (
  clip: { assetId?: string; src?: string }
): string {
  const explicit = (clip.assetId || '').trim()
  if (explicit) return explicit
  const parsed = parseProjectAssetMediaIds(stripPlaybackTokenFromUrl(clip.src || ''))
  return parsed?.assetId || ''
}

export function srcMatchesAssetId (src: string, assetId: string): boolean {
  if (!assetId.trim()) return false
  const parsed = parseProjectAssetMediaIds(stripPlaybackTokenFromUrl(src))
  return parsed?.assetId === assetId.trim()
}

export function canResolveClipFromAssetId (
  clip: { assetId?: string; src?: string },
  projectId: string
): boolean {
  const assetId = clipEffectiveAssetId(clip)
  if (!assetId || !projectId.trim()) return false
  const src = (clip.src || '').trim()
  if (!src) return true
  if (isBlobTimelineUrl(src)) return true
  if (!isDurableProjectAssetUrl(src)) return true
  if (!srcMatchesAssetId(src, assetId)) return true
  return false
}

export function resolvePlaybackUrlFromAssetId (
  projectId: string,
  assetId: string,
  token?: string | null,
  asset?: Pick<ProjectAsset, 'id' | 'projectId' | 'fileUrl'> | null
): string {
  const pid = projectId.trim()
  const aid = assetId.trim()
  if (!pid || !aid) return ''
  if (asset?.id === aid) {
    return projectAssetPlaybackSrc(asset, token)
  }
  return appendPlaybackAccessToken(projectAssetMediaPath(pid, aid), token)
}

export function classifyTimelineClipMedia (
  clip: Pick<TimelineEditorClip, 'src' | 'assetId'>,
  opts?: {
    projectId?: string
    assetsById?: Map<string, ProjectAsset>
  }
): TimelineClipMediaReliability {
  const src = (clip.src || '').trim()
  const assetId = clipEffectiveAssetId(clip)
  const projectId = (opts?.projectId || '').trim()

  if (isBlobTimelineUrl(src)) return 'local_blob'

  if (!src && !assetId) return 'missing'

  if (assetId && projectId && canResolveClipFromAssetId(clip, projectId)) {
    const asset = opts?.assetsById?.get(assetId)
    if (asset || !src) return 'recoverable'
    if (isBlobTimelineUrl(src) || !isDurableProjectAssetUrl(src)) return 'recoverable'
  }

  if (!src) return assetId ? 'recoverable' : 'missing'

  if (isDurableProjectAssetUrl(src)) {
    if (assetId && !srcMatchesAssetId(src, assetId)) return 'recoverable'
    return 'cloud_asset'
  }

  if (assetId && projectId) {
    return 'recoverable'
  }

  return 'url_only'
}

export function resolveTimelineClipPlaybackSrc (
  clip: TimelineEditorClip,
  projectId: string,
  token: string | null | undefined,
  opts?: {
    assetsById?: Map<string, ProjectAsset>
    /** Runtime-only repairs (not persisted until user saves). */
    preferRuntimeRepair?: boolean
  }
): string {
  const assetId = clipEffectiveAssetId(clip)
  const reliability = classifyTimelineClipMedia(clip, {
    projectId,
    assetsById: opts?.assetsById
  })

  if (
    assetId &&
    projectId.trim() &&
    (opts?.preferRuntimeRepair !== false) &&
    (reliability === 'recoverable' || reliability === 'missing')
  ) {
    const asset = opts?.assetsById?.get(assetId)
    const resolved = resolvePlaybackUrlFromAssetId(projectId, assetId, token, asset)
    if (resolved) return resolved
  }

  const raw = (clip.src || '').trim()
  if (!raw) return ''
  return appendPlaybackAccessToken(raw, token)
}

export function buildRepairedClipSrc (
  clip: TimelineEditorClip,
  projectId: string,
  assetsById?: Map<string, ProjectAsset>
): string | null {
  const assetId = clipEffectiveAssetId(clip)
  if (!assetId || !projectId.trim()) return null
  const asset = assetsById?.get(assetId)
  const resolved = resolvePlaybackUrlFromAssetId(projectId, assetId, null, asset)
  if (!resolved) return null
  return stripPlaybackTokenFromUrl(resolved)
}

export function timelineMediaReliabilitySummary (
  clips: TimelineEditorClip[],
  opts?: { projectId?: string; assetsById?: Map<string, ProjectAsset> }
): Record<TimelineClipMediaReliability, number> {
  const counts: Record<TimelineClipMediaReliability, number> = {
    cloud_asset: 0,
    url_only: 0,
    local_blob: 0,
    missing: 0,
    recoverable: 0
  }
  for (const clip of clips) {
    const kind = classifyTimelineClipMedia(clip, opts)
    counts[kind]++
  }
  return counts
}
