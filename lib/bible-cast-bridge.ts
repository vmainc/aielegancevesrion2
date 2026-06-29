import { bibleEntityDedupeKey, BIBLE_SEED_CHARACTER_SOURCE } from '~/lib/bible-seed-normalize'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleRelationship } from '~/types/bible-relationship'

export const BIBLE_CAST_REPRESENTS_RELATIONSHIP = 'represents'
export const BIBLE_CAST_BRIDGE_SOURCE_TYPE = 'cast_bridge'
export const BIBLE_CAST_BRIDGE_ACTOR_ID = 'cast_bridge'

export type CastBibleMatchConfidence = 'explicit' | 'relationship' | 'name' | 'ambiguous' | 'none'

export interface CastBibleEntityLink {
  entityId: string
  confidence: CastBibleMatchConfidence
}

export interface CastBibleCharacterLink {
  characterId: string
  confidence: CastBibleMatchConfidence
}

export interface CastBibleBridgeMaps {
  characterToEntity: Map<string, CastBibleEntityLink>
  entityToCharacter: Map<string, CastBibleCharacterLink>
}

export function castBibleConfidenceLabel (confidence: CastBibleMatchConfidence): string {
  switch (confidence) {
    case 'explicit':
      return 'Explicit link (metadata)'
    case 'relationship':
      return 'Linked via represents relationship'
    case 'name':
      return 'Name match'
    case 'ambiguous':
      return 'Ambiguous name match'
    default:
      return 'Not linked'
  }
}

export function castBibleConfidencePriority (confidence: CastBibleMatchConfidence): number {
  switch (confidence) {
    case 'explicit':
      return 97
    case 'relationship':
      return 96
    case 'name':
      return 93
    case 'ambiguous':
      return 80
    default:
      return 0
  }
}

function setCharacterLink (
  maps: CastBibleBridgeMaps,
  characterId: string,
  entityId: string,
  confidence: CastBibleMatchConfidence
) {
  const prev = maps.characterToEntity.get(characterId)
  if (prev && castBibleConfidencePriority(prev.confidence) >= castBibleConfidencePriority(confidence)) {
    return
  }
  maps.characterToEntity.set(characterId, { entityId, confidence })
  maps.entityToCharacter.set(entityId, { characterId, confidence })
}

export function buildCastBibleBridgeMaps (
  entities: BibleEntity[],
  characters: Array<{ id: string; name: string }>,
  relationships: BibleRelationship[] = []
): CastBibleBridgeMaps {
  const maps: CastBibleBridgeMaps = {
    characterToEntity: new Map(),
    entityToCharacter: new Map()
  }

  const entityById = new Map(entities.map((e) => [e.id, e]))

  for (const e of entities) {
    if (e.type !== 'character') continue
    if (e.sourceType === BIBLE_SEED_CHARACTER_SOURCE && e.sourceId) {
      setCharacterLink(maps, e.sourceId, e.id, 'explicit')
    }
  }

  for (const rel of relationships) {
    if (rel.relationshipType !== BIBLE_CAST_REPRESENTS_RELATIONSHIP) continue
    if (rel.fromType === 'bible_entity' && rel.toType === 'creative_character') {
      if (entityById.get(rel.fromId)?.type === 'character') {
        setCharacterLink(maps, rel.toId, rel.fromId, 'relationship')
      }
    }
    if (rel.fromType === 'creative_character' && rel.toType === 'bible_entity') {
      if (entityById.get(rel.toId)?.type === 'character') {
        setCharacterLink(maps, rel.fromId, rel.toId, 'relationship')
      }
    }
  }

  for (const c of characters) {
    if (maps.characterToEntity.has(c.id)) continue
    const matches = entities.filter(
      (e) =>
        e.type === 'character' &&
        bibleEntityDedupeKey(e.type, e.name) === bibleEntityDedupeKey('character', c.name)
    )
    if (matches.length === 1) {
      setCharacterLink(maps, c.id, matches[0]!.id, 'name')
    } else if (matches.length > 1) {
      maps.characterToEntity.set(c.id, {
        entityId: matches[0]!.id,
        confidence: 'ambiguous'
      })
    }
  }

  return maps
}

export function resolveCastCharacterToBibleEntity (
  characterId: string,
  characterName: string,
  entities: BibleEntity[],
  relationships: BibleRelationship[] = []
): CastBibleEntityLink | null {
  const maps = buildCastBibleBridgeMaps(entities, [{ id: characterId, name: characterName }], relationships)
  return maps.characterToEntity.get(characterId) ?? null
}

export function resolveBibleEntityToCastCharacter (
  entity: Pick<BibleEntity, 'id' | 'type' | 'name' | 'sourceType' | 'sourceId'>,
  characters: Array<{ id: string; name: string }>,
  relationships: BibleRelationship[] = []
): CastBibleCharacterLink | null {
  if (entity.type !== 'character') return null
  const maps = buildCastBibleBridgeMaps(
    [entity as BibleEntity],
    characters,
    relationships
  )
  return maps.entityToCharacter.get(entity.id) ?? null
}

export function isUserAuthoredBibleEntity (entity: Pick<BibleEntity, 'actorType'>): boolean {
  return entity.actorType === 'user'
}

export function canSafelyAttachCastMetadata (
  entity: Pick<BibleEntity, 'actorType' | 'sourceType' | 'sourceId'>,
  characterId: string
): boolean {
  if (isUserAuthoredBibleEntity(entity)) return false
  const sourceId = entity.sourceId?.trim() || ''
  if (!sourceId) return true
  return sourceId === characterId
}
