import { projectAssetPlaybackSrc } from '~/lib/project-asset-playback-url'
import type { ProjectAsset } from '~/types/project-asset'

export type CharacterVoiceSample = {
  assetId: string
  projectId: string
  title: string
  url: string
  created: string
}

export function isCharacterVoiceSampleAsset (metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  return metadata.source === 'character_voice_sample'
}

export function isCharacterPortraitAsset (metadata: Record<string, unknown> | null | undefined): boolean {
  return !isCharacterVoiceSampleAsset(metadata)
}

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Voice reference clips per character id (all samples, newest first within each character).
 */
export function voiceSamplesByCharacterIdFromAssets (
  characters: Array<{ id: string; name: string }>,
  assets: ProjectAsset[],
  token: string | null
): Record<string, CharacterVoiceSample[]> {
  const byCharacterId: Record<string, CharacterVoiceSample[]> = {}
  const byCharacterName: Record<string, CharacterVoiceSample[]> = {}

  for (const a of assets) {
    if (!a.id || !a.projectId) continue
    const meta = a.metadata || {}
    if (!isCharacterVoiceSampleAsset(meta as Record<string, unknown>)) continue

    const cid = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    const cname = typeof meta.character_name === 'string' ? normalizeName(meta.character_name) : ''
    const sample: CharacterVoiceSample = {
      assetId: a.id,
      projectId: a.projectId,
      title: (a.title || 'Voice sample').trim(),
      url: projectAssetPlaybackSrc(
        { id: a.id, projectId: a.projectId, fileUrl: a.fileUrl || '' },
        token
      ),
      created: a.created || a.updated || ''
    }

    if (cid) {
      if (!byCharacterId[cid]) byCharacterId[cid] = []
      byCharacterId[cid].push(sample)
    }
    if (cname) {
      if (!byCharacterName[cname]) byCharacterName[cname] = []
      byCharacterName[cname].push(sample)
    }
  }

  const sortNewest = (list: CharacterVoiceSample[]) =>
    [...list].sort((a, b) => (b.created || '').localeCompare(a.created || ''))

  const out: Record<string, CharacterVoiceSample[]> = {}
  for (const c of characters) {
    const fromId = byCharacterId[c.id] || []
    const fromName = byCharacterName[normalizeName(c.name)] || []
    const merged = fromId.length ? fromId : fromName
    out[c.id] = sortNewest(merged)
  }
  return out
}
