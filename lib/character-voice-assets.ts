import { projectAssetPlaybackSrc } from '~/lib/project-asset-playback-url'
import type { ProjectAsset } from '~/types/project-asset'

export type CharacterReferenceClip = {
  assetId: string
  projectId: string
  title: string
  url: string
  created: string
  mediaType: 'audio' | 'video'
  mannerismLabel?: string
}

/** @deprecated Use CharacterReferenceClip */
export type CharacterVoiceSample = CharacterReferenceClip

export function isCharacterVoiceSampleAsset (metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  return metadata.source === 'character_voice_sample'
}

export function isCharacterPerformanceClipAsset (metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  return metadata.source === 'character_performance_clip'
}

export function isCharacterReferenceClipAsset (metadata: Record<string, unknown> | null | undefined): boolean {
  return isCharacterVoiceSampleAsset(metadata) || isCharacterPerformanceClipAsset(metadata)
}

export function isCharacterPortraitAsset (metadata: Record<string, unknown> | null | undefined): boolean {
  return !isCharacterReferenceClipAsset(metadata)
}

function mediaTypeFromAsset (meta: Record<string, unknown>, fileUrl: string): 'audio' | 'video' {
  if (meta.media_type === 'video' || isCharacterPerformanceClipAsset(meta)) return 'video'
  if (meta.media_type === 'audio' || isCharacterVoiceSampleAsset(meta)) return 'audio'
  const url = (fileUrl || '').toLowerCase()
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return 'video'
  return 'audio'
}

function mannerismLabelFromMeta (meta: Record<string, unknown>): string {
  const v = meta.mannerism_label ?? meta.mannerismLabel
  return typeof v === 'string' ? v.trim() : ''
}

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Voice + performance reference clips per character id (newest first within each character).
 */
export function referenceClipsByCharacterIdFromAssets (
  characters: Array<{ id: string; name: string }>,
  assets: ProjectAsset[],
  token: string | null
): Record<string, CharacterReferenceClip[]> {
  const byCharacterId: Record<string, CharacterReferenceClip[]> = {}
  const byCharacterName: Record<string, CharacterReferenceClip[]> = {}

  for (const a of assets) {
    if (!a.id || !a.projectId) continue
    const meta = (a.metadata || {}) as Record<string, unknown>
    if (!isCharacterReferenceClipAsset(meta)) continue

    const cid = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    const cname = typeof meta.character_name === 'string' ? normalizeName(meta.character_name) : ''
    const clip: CharacterReferenceClip = {
      assetId: a.id,
      projectId: a.projectId,
      title: (a.title || 'Reference clip').trim(),
      url: projectAssetPlaybackSrc(
        { id: a.id, projectId: a.projectId, fileUrl: a.fileUrl || '' },
        token
      ),
      created: a.created || a.updated || '',
      mediaType: mediaTypeFromAsset(meta, a.fileUrl || ''),
      mannerismLabel: mannerismLabelFromMeta(meta) || undefined
    }

    if (cid) {
      if (!byCharacterId[cid]) byCharacterId[cid] = []
      byCharacterId[cid].push(clip)
    }
    if (cname) {
      if (!byCharacterName[cname]) byCharacterName[cname] = []
      byCharacterName[cname].push(clip)
    }
  }

  const sortNewest = (list: CharacterReferenceClip[]) =>
    [...list].sort((a, b) => (b.created || '').localeCompare(a.created || ''))

  const out: Record<string, CharacterReferenceClip[]> = {}
  for (const c of characters) {
    const fromId = byCharacterId[c.id] || []
    const fromName = byCharacterName[normalizeName(c.name)] || []
    const merged = fromId.length ? fromId : fromName
    out[c.id] = sortNewest(merged)
  }
  return out
}

/** @deprecated Use referenceClipsByCharacterIdFromAssets */
export function voiceSamplesByCharacterIdFromAssets (
  characters: Array<{ id: string; name: string }>,
  assets: ProjectAsset[],
  token: string | null
): Record<string, CharacterReferenceClip[]> {
  return referenceClipsByCharacterIdFromAssets(characters, assets, token)
}
