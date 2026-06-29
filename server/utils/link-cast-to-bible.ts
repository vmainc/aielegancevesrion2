import type PocketBase from 'pocketbase'
import {
  BIBLE_CAST_BRIDGE_ACTOR_ID,
  BIBLE_CAST_BRIDGE_SOURCE_TYPE,
  BIBLE_CAST_REPRESENTS_RELATIONSHIP,
  buildCastBibleBridgeMaps,
  canSafelyAttachCastMetadata,
  type CastBibleMatchConfidence
} from '~/lib/bible-cast-bridge'
import {
  bibleEntityDedupeKey,
  BIBLE_SEED_CHARACTER_SOURCE,
  BIBLE_SEED_ENTITY_STATUS,
  bibleRelationshipDedupeKey
} from '~/lib/bible-seed-normalize'
import { pbRecordToCreativeCharacter, projectIdOnCharacterRow } from '~/server/utils/creative-character-map'
import { pbRecordToBibleEntity } from '~/server/utils/bible-entity-map'
import { pbRecordToBibleRelationship } from '~/server/utils/bible-relationship-map'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleCastLinkResult, BibleCastLinkRow } from '~/types/bible-cast-link-result'
import type { CreativeCharacter } from '~/types/creative-project'

async function loadCharacters (pb: PocketBase, projectId: string): Promise<CreativeCharacter[]> {
  try {
    const rows = await pb.collection('creative_characters').getFullList({
      filter: `project="${projectId}"`,
      batch: 200
    })
    return rows.map((r) => pbRecordToCreativeCharacter(r as Record<string, unknown>))
  } catch {
    try {
      const all = await pb.collection('creative_characters').getFullList({ batch: 400 })
      return all
        .filter((r) => projectIdOnCharacterRow(r as Record<string, unknown>) === projectId)
        .map((r) => pbRecordToCreativeCharacter(r as Record<string, unknown>))
    } catch {
      return []
    }
  }
}

async function loadEntities (pb: PocketBase, projectId: string): Promise<BibleEntity[]> {
  try {
    const rows = await pb.collection('bible_entities').getFullList({
      filter: `project="${projectId}"`,
      batch: 500
    })
    return rows.map((r) => pbRecordToBibleEntity(r as Parameters<typeof pbRecordToBibleEntity>[0]))
  } catch {
    return []
  }
}

async function loadRelationships (pb: PocketBase, projectId: string) {
  try {
    const rows = await pb.collection('bible_relationships').getFullList({
      filter: `project="${projectId}"`,
      batch: 500
    })
    return rows.map((r) =>
      pbRecordToBibleRelationship(r as Parameters<typeof pbRecordToBibleRelationship>[0])
    )
  } catch {
    return []
  }
}

function characterEntitiesByName (entities: BibleEntity[], name: string): BibleEntity[] {
  const key = bibleEntityDedupeKey('character', name)
  return entities.filter(
    (e) => e.type === 'character' && bibleEntityDedupeKey(e.type, e.name) === key
  )
}

export async function linkCastToBible (opts: {
  pb: PocketBase
  userId: string
  projectId: string
  dryRun?: boolean
}): Promise<BibleCastLinkResult> {
  const { pb, userId, projectId, dryRun = false } = opts

  const result: BibleCastLinkResult = {
    dryRun,
    matchedCount: 0,
    createdCount: 0,
    linkedCount: 0,
    skippedCount: 0,
    ambiguousCount: 0,
    matched: [],
    created: [],
    linked: [],
    skipped: [],
    ambiguous: []
  }

  const [characters, entities, relationships] = await Promise.all([
    loadCharacters(pb, projectId),
    loadEntities(pb, projectId),
    loadRelationships(pb, projectId)
  ])

  const relKeys = new Set(
    relationships.map((r) =>
      bibleRelationshipDedupeKey({
        fromType: r.fromType,
        fromId: r.fromId,
        toType: r.toType,
        toId: r.toId,
        relationshipType: r.relationshipType
      })
    )
  )

  const bridge = buildCastBibleBridgeMaps(entities, characters, relationships)
  const entityById = new Map(entities.map((e) => [e.id, e]))

  for (const c of characters) {
    if (!c.name.trim()) {
      result.skippedCount++
      result.skipped.push({
        characterId: c.id,
        characterName: c.name,
        reason: 'empty character name'
      })
      continue
    }

    const existing = bridge.characterToEntity.get(c.id)
    if (existing && existing.confidence !== 'ambiguous') {
      const ent = entityById.get(existing.entityId)
      result.matchedCount++
      result.matched.push({
        characterId: c.id,
        characterName: c.name,
        entityId: existing.entityId,
        entityName: ent?.name || '',
        confidence: existing.confidence
      })
      continue
    }

    if (existing?.confidence === 'ambiguous') {
      const candidates = characterEntitiesByName(entities, c.name).map((e) => e.id)
      result.ambiguousCount++
      result.ambiguous.push({
        characterId: c.id,
        characterName: c.name,
        candidateEntityIds: candidates,
        confidence: 'ambiguous',
        reason: 'multiple bible character entities share this name'
      })
      continue
    }

    const nameMatches = characterEntitiesByName(entities, c.name)
    if (nameMatches.length > 1) {
      result.ambiguousCount++
      result.ambiguous.push({
        characterId: c.id,
        characterName: c.name,
        candidateEntityIds: nameMatches.map((e) => e.id),
        confidence: 'ambiguous',
        reason: 'multiple bible character entities share this name'
      })
      continue
    }

    if (nameMatches.length === 1) {
      const ent = nameMatches[0]!
      if (!canSafelyAttachCastMetadata(ent, c.id)) {
        result.skippedCount++
        result.skipped.push({
          characterId: c.id,
          characterName: c.name,
          entityId: ent.id,
          entityName: ent.name,
          reason: ent.actorType === 'user'
            ? 'user-authored bible entity'
            : 'entity already linked to a different cast record'
        })
        continue
      }

      if (!dryRun) {
        await pb.collection('bible_entities').update(ent.id, {
          source_type: BIBLE_SEED_CHARACTER_SOURCE,
          source_id: c.id
        })
        const relKey = bibleRelationshipDedupeKey({
          fromType: 'bible_entity',
          fromId: ent.id,
          toType: 'creative_character',
          toId: c.id,
          relationshipType: BIBLE_CAST_REPRESENTS_RELATIONSHIP
        })
        if (!relKeys.has(relKey)) {
          await pb.collection('bible_relationships').create({
            owned_by: userId,
            project: projectId,
            from_type: 'bible_entity',
            from_id: ent.id,
            to_type: 'creative_character',
            to_id: c.id,
            relationship_type: BIBLE_CAST_REPRESENTS_RELATIONSHIP,
            status: BIBLE_SEED_ENTITY_STATUS,
            source_type: BIBLE_CAST_BRIDGE_SOURCE_TYPE,
            actor_type: 'system',
            actor_id: BIBLE_CAST_BRIDGE_ACTOR_ID
          })
          relKeys.add(relKey)
        }
      }

      result.linkedCount++
      result.linked.push({
        characterId: c.id,
        characterName: c.name,
        entityId: ent.id,
        entityName: ent.name,
        confidence: 'name' satisfies CastBibleMatchConfidence
      })
      continue
    }

    const summary = c.roleDescription?.trim().slice(0, 5000) || ''
    let entityId = `dry-character-${c.id}`

    if (!dryRun) {
      const created = await pb.collection('bible_entities').create({
        owned_by: userId,
        project: projectId,
        entity_type: 'character',
        name: c.name.trim().slice(0, 500),
        summary,
        description: summary.slice(0, 50_000),
        status: BIBLE_SEED_ENTITY_STATUS,
        source_type: BIBLE_SEED_CHARACTER_SOURCE,
        source_id: c.id,
        actor_type: 'system',
        actor_id: BIBLE_CAST_BRIDGE_ACTOR_ID
      })
      entityId = pbRecordToBibleEntity(created as Parameters<typeof pbRecordToBibleEntity>[0]).id

      const relKey = bibleRelationshipDedupeKey({
        fromType: 'bible_entity',
        fromId: entityId,
        toType: 'creative_character',
        toId: c.id,
        relationshipType: BIBLE_CAST_REPRESENTS_RELATIONSHIP
      })
      if (!relKeys.has(relKey)) {
        await pb.collection('bible_relationships').create({
          owned_by: userId,
          project: projectId,
          from_type: 'bible_entity',
          from_id: entityId,
          to_type: 'creative_character',
          to_id: c.id,
          relationship_type: BIBLE_CAST_REPRESENTS_RELATIONSHIP,
          status: BIBLE_SEED_ENTITY_STATUS,
          source_type: BIBLE_CAST_BRIDGE_SOURCE_TYPE,
          actor_type: 'system',
          actor_id: BIBLE_CAST_BRIDGE_ACTOR_ID
        })
        relKeys.add(relKey)
      }
    }

    result.createdCount++
    result.created.push({
      characterId: c.id,
      characterName: c.name,
      entityId,
      entityName: c.name,
      confidence: 'explicit'
    })
  }

  return result
}
