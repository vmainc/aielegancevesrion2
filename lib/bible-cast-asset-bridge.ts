import {
  buildCastBibleBridgeMaps,
  resolveBibleEntityToCastCharacter,
  resolveCastCharacterToBibleEntity,
  type CastBibleBridgeMaps
} from '~/lib/bible-cast-bridge'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleRelationship } from '~/types/bible-relationship'
import type { ProjectAsset } from '~/types/project-asset'

export const BIBLE_ASSET_ENTITY_METADATA_KEY = 'bible_entity_id'

export type AssetBibleLinkSource =
  | 'bible_entity_metadata'
  | 'cast_character_link'
  | 'scene_shot'

export interface AssetBridgeFields {
  characterId: string
  bibleEntityId: string
  sceneId: string
  shotId: string
  promptUsed: string
  characterName: string
  characterIds: string[]
}

export interface EntityRelatedAsset {
  asset: ProjectAsset
  linkSources: AssetBibleLinkSource[]
}

function metaRecord (asset: ProjectAsset): Record<string, unknown> {
  return asset.metadata && typeof asset.metadata === 'object'
    ? (asset.metadata as Record<string, unknown>)
    : {}
}

function readString (meta: Record<string, unknown>, key: string): string {
  const v = meta[key]
  return typeof v === 'string' ? v.trim() : ''
}

function readCharacterIds (meta: Record<string, unknown>): string[] {
  const raw = meta.character_ids
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.trim()).map((id) => id.trim())
}

/** Read cast / bible / scene metadata from a project asset. */
export function readAssetBridgeFields (metadata: Record<string, unknown> | null): AssetBridgeFields {
  const meta = metadata && typeof metadata === 'object' ? metadata : {}
  const characterIds = readCharacterIds(meta)
  const characterId = readString(meta, 'character_id') || characterIds[0] || ''
  return {
    characterId,
    bibleEntityId: readString(meta, BIBLE_ASSET_ENTITY_METADATA_KEY),
    sceneId: readString(meta, 'scene_id'),
    shotId: readString(meta, 'shot_id'),
    promptUsed: readString(meta, 'prompt_used'),
    characterName: readString(meta, 'character_name'),
    characterIds
  }
}

export function assetBibleLinkSourceLabel (source: AssetBibleLinkSource): string {
  switch (source) {
    case 'bible_entity_metadata':
      return 'Direct Bible link'
    case 'cast_character_link':
      return 'Cast character link'
    case 'scene_shot':
      return 'Scene / shot metadata'
    default:
      return 'Linked'
  }
}

function assetMatchesCharacter (
  fields: AssetBridgeFields,
  characterId: string
): boolean {
  if (!characterId) return false
  if (fields.characterId === characterId) return true
  return fields.characterIds.includes(characterId)
}

function collectAssetLinkSources (
  asset: ProjectAsset,
  entity: BibleEntity,
  linkedCharacterId: string | undefined
): AssetBibleLinkSource[] {
  const fields = readAssetBridgeFields(asset.metadata)
  const sources: AssetBibleLinkSource[] = []

  if (fields.bibleEntityId && fields.bibleEntityId === entity.id) {
    sources.push('bible_entity_metadata')
  }

  if (linkedCharacterId && assetMatchesCharacter(fields, linkedCharacterId)) {
    if (!sources.includes('cast_character_link')) {
      sources.push('cast_character_link')
    }
  }

  if ((fields.sceneId || fields.shotId) && sources.length) {
    sources.push('scene_shot')
  }

  return sources
}

export function resolveAssetToCastCharacter (
  asset: ProjectAsset,
  characters: Array<{ id: string; name: string }>
): { characterId: string; characterName: string } | null {
  const fields = readAssetBridgeFields(asset.metadata)
  if (fields.characterId) {
    const hit = characters.find((c) => c.id === fields.characterId)
    return {
      characterId: fields.characterId,
      characterName: hit?.name || fields.characterName || fields.characterId
    }
  }
  if (fields.characterName) {
    const key = fields.characterName.trim().toLowerCase()
    const hit = characters.find((c) => c.name.trim().toLowerCase() === key)
    if (hit) return { characterId: hit.id, characterName: hit.name }
  }
  return null
}

export function resolveAssetToBibleEntity (
  asset: ProjectAsset,
  entities: BibleEntity[],
  characters: Array<{ id: string; name: string }>,
  relationships: BibleRelationship[] = [],
  bridgeMaps?: CastBibleBridgeMaps
): { entityId: string; entityName: string; linkSources: AssetBibleLinkSource[] } | null {
  const fields = readAssetBridgeFields(asset.metadata)
  const maps = bridgeMaps ?? buildCastBibleBridgeMaps(entities, characters, relationships)

  if (fields.bibleEntityId) {
    const ent = entities.find((e) => e.id === fields.bibleEntityId)
    if (ent) {
      const sources: AssetBibleLinkSource[] = ['bible_entity_metadata']
      if (fields.sceneId || fields.shotId) sources.push('scene_shot')
      return { entityId: ent.id, entityName: ent.name, linkSources: sources }
    }
  }

  const cast = resolveAssetToCastCharacter(asset, characters)
  if (cast) {
    const link = maps.characterToEntity.get(cast.characterId)
    if (link && link.confidence !== 'ambiguous') {
      const ent = entities.find((e) => e.id === link.entityId)
      if (ent) {
        const sources: AssetBibleLinkSource[] = ['cast_character_link']
        if (fields.sceneId || fields.shotId) sources.push('scene_shot')
        return { entityId: ent.id, entityName: ent.name, linkSources: sources }
      }
    }
  }

  return null
}

/** Assets related to a bible entity (read-only resolution). */
export function resolveBibleEntityRelatedAssets (
  entity: BibleEntity,
  assets: ProjectAsset[],
  entities: BibleEntity[],
  characters: Array<{ id: string; name: string }>,
  relationships: BibleRelationship[] = [],
  _bridgeMaps?: CastBibleBridgeMaps
): EntityRelatedAsset[] {
  const castLink =
    entity.type === 'character'
      ? resolveBibleEntityToCastCharacter(entity, characters, relationships)
      : null
  const linkedCharacterId =
    castLink && castLink.confidence !== 'ambiguous' ? castLink.characterId : undefined

  const out: EntityRelatedAsset[] = []
  for (const asset of assets) {
    const linkSources = collectAssetLinkSources(asset, entity, linkedCharacterId)
    if (!linkSources.length) continue
    out.push({ asset, linkSources })
  }

  out.sort((a, b) => {
    const ta = String(a.asset.updated || a.asset.created || '')
    const tb = String(b.asset.updated || b.asset.created || '')
    return tb.localeCompare(ta)
  })

  return out
}

export function resolveCastCharacterBibleEntity (
  characterId: string,
  characterName: string,
  entities: BibleEntity[],
  relationships: BibleRelationship[] = []
) {
  return resolveCastCharacterToBibleEntity(characterId, characterName, entities, relationships)
}

export function countAssetsForCastCharacter (
  assets: ProjectAsset[],
  characterId: string
): number {
  if (!characterId) return 0
  return assets.filter((a) => assetMatchesCharacter(readAssetBridgeFields(a.metadata), characterId)).length
}

export function assetsLinkableToBibleEntity (
  entity: BibleEntity,
  assets: ProjectAsset[],
  linkedCharacterId: string | undefined
): ProjectAsset[] {
  if (!linkedCharacterId) return []
  return assets.filter((a) => {
    const fields = readAssetBridgeFields(a.metadata)
    if (fields.bibleEntityId === entity.id) return false
    return assetMatchesCharacter(fields, linkedCharacterId)
  })
}
