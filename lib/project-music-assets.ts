import type { ProjectAsset } from '~/types/project-asset'

export function isMusicLibraryAsset (asset: Pick<ProjectAsset, 'metadata'>): boolean {
  const meta = asset.metadata
  if (!meta || typeof meta !== 'object') return false
  const source = typeof meta.source === 'string' ? meta.source.trim() : ''
  return source === 'music_generation' || source === 'music_upload'
}

export function filterMusicLibraryAssets (items: ProjectAsset[]): ProjectAsset[] {
  return items.filter(isMusicLibraryAsset)
}
