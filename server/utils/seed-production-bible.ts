import type PocketBase from 'pocketbase'
import { castNameAppearsInText } from '~/lib/cast-name-convention'
import {
  bibleEntityDedupeKey,
  bibleRelationshipDedupeKey,
  BIBLE_SEED_CHARACTER_SOURCE,
  BIBLE_SEED_ENTITY_STATUS,
  BIBLE_SEED_FACT_STATUS,
  BIBLE_SEED_RELATIONSHIP_STATUS,
  BIBLE_SEED_SOURCE_TYPE,
  normalizeBibleEntityNameKey,
  normalizeBibleFactStatementKey
} from '~/lib/bible-seed-normalize'
import { extractLocationFromSceneHeading } from '~/lib/bible-scene-location'
import { pbRecordToCreativeCharacter, projectIdOnCharacterRow } from '~/server/utils/creative-character-map'
import { pbRecordToCreativeScene } from '~/server/utils/creative-scene-map'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'
import { pbRecordToBibleEntity, projectIdOnBibleEntityRow } from '~/server/utils/bible-entity-map'
import { pbRecordToBibleFact, projectIdOnBibleFactRow } from '~/server/utils/bible-fact-map'
import {
  pbRecordToBibleRelationship,
  projectIdOnBibleRelationshipRow
} from '~/server/utils/bible-relationship-map'
import { BIBLE_ENTITY_TYPES, type BibleEntityType } from '~/types/bible-entity'
import type { BibleSeedResult } from '~/types/bible-seed-result'
import type { CreativeCharacter } from '~/types/creative-project'

const CHARACTER_FACT_FIELDS: Array<{
  key: keyof CreativeCharacter
  factType: string
  prefix: string
}> = [
  { key: 'appearanceDescription', factType: 'appearance', prefix: 'Appearance' },
  { key: 'roleDescription', factType: 'provenance', prefix: 'Role' },
  { key: 'personality', factType: 'rule', prefix: 'Personality' },
  { key: 'voiceDescription', factType: 'style', prefix: 'Voice' },
  { key: 'signatureDetails', factType: 'wardrobe', prefix: 'Signature details' },
  { key: 'avoidDescription', factType: 'negative_constraint', prefix: 'Avoid' }
]

function assetMeta (raw: Record<string, unknown>): Record<string, unknown> {
  const m = raw.metadata
  if (m && typeof m === 'object' && !Array.isArray(m)) return m as Record<string, unknown>
  return {}
}

function structuredMetadataEntity (
  meta: Record<string, unknown>
): { type: BibleEntityType; name: string } | null {
  const t = typeof meta.bible_entity_type === 'string' ? meta.bible_entity_type.trim() : ''
  const n =
    typeof meta.bible_entity_name === 'string'
      ? meta.bible_entity_name.trim()
      : typeof meta.entity_name === 'string'
        ? meta.entity_name.trim()
        : ''
  if (!t || !n) return null
  if (!BIBLE_ENTITY_TYPES.includes(t as BibleEntityType)) return null
  if (t === 'character' || t === 'location') return null
  return { type: t as BibleEntityType, name: n }
}

function buildCharacterDescription (c: CreativeCharacter): string {
  const parts = [
    c.roleDescription,
    c.appearanceDescription,
    c.personality,
    c.signatureDetails
  ].filter((p) => typeof p === 'string' && p.trim())
  return parts.join('\n\n').slice(0, 50_000)
}

function buildCharacterSummary (c: CreativeCharacter): string {
  const primary = c.roleDescription.trim() || c.appearanceDescription.trim()
  return primary.slice(0, 5000)
}

export async function seedProductionBibleFromProject (opts: {
  pb: PocketBase
  userId: string
  projectId: string
  dryRun?: boolean
}): Promise<BibleSeedResult> {
  const { pb, userId, projectId, dryRun = false } = opts

  const result: BibleSeedResult = {
    dryRun,
    entitiesCreated: 0,
    entitiesSkippedDuplicate: 0,
    factsCreated: 0,
    factsSkippedDuplicate: 0,
    relationshipsCreated: 0,
    relationshipsSkippedDuplicate: 0,
    unsupported: [],
    created: { entities: [], facts: [], relationships: [] },
    skipped: { entities: [], relationships: [] }
  }

  const [characterRows, sceneRows, shotRows, assetRows, entityRows, factRows, relRows] =
    await Promise.all([
      loadCollection(pb, 'creative_characters', `project="${projectId}"`, projectIdOnCharacterRow),
      loadCollection(pb, 'creative_scenes', `project="${projectId}"`),
      loadCollection(pb, 'creative_shots', `project="${projectId}"`),
      loadCollection(pb, 'project_assets', `project="${projectId}"`),
      loadCollection(pb, 'bible_entities', `project="${projectId}"`, projectIdOnBibleEntityRow),
      loadCollection(pb, 'bible_facts', `project="${projectId}"`, projectIdOnBibleFactRow),
      loadCollection(pb, 'bible_relationships', `project="${projectId}"`, projectIdOnBibleRelationshipRow)
    ])

  const characters = characterRows.map((r) => pbRecordToCreativeCharacter(r))
  const scenes = sceneRows.map((r) => pbRecordToCreativeScene(r as Parameters<typeof pbRecordToCreativeScene>[0]))
  const shots = shotRows.map((r) => pbRecordToCreativeShot(r as Parameters<typeof pbRecordToCreativeShot>[0]))
  const existingEntities = entityRows.map((r) =>
    pbRecordToBibleEntity(r as Parameters<typeof pbRecordToBibleEntity>[0])
  )
  const existingFacts = factRows.map((r) =>
    pbRecordToBibleFact(r as Parameters<typeof pbRecordToBibleFact>[0])
  )
  const existingRels = relRows.map((r) =>
    pbRecordToBibleRelationship(r as Parameters<typeof pbRecordToBibleRelationship>[0])
  )

  const entityByKey = new Map<string, string>()
  const characterIdToEntityId = new Map<string, string>()
  const factKeys = new Set<string>()
  const relKeys = new Set<string>()

  for (const e of existingEntities) {
    entityByKey.set(bibleEntityDedupeKey(e.type, e.name), e.id)
    if (e.sourceType === BIBLE_SEED_CHARACTER_SOURCE && e.sourceId) {
      characterIdToEntityId.set(e.sourceId, e.id)
    }
  }

  for (const c of characters) {
    const key = bibleEntityDedupeKey('character', c.name)
    const byName = entityByKey.get(key)
    if (byName) characterIdToEntityId.set(c.id, byName)
  }

  for (const f of existingFacts) {
    if (f.entityId) {
      factKeys.add(`${f.entityId}:${normalizeBibleFactStatementKey(f.statement)}`)
    }
  }

  for (const r of existingRels) {
    relKeys.add(
      bibleRelationshipDedupeKey({
        fromType: r.fromType,
        fromId: r.fromId,
        toType: r.toType,
        toId: r.toId,
        relationshipType: r.relationshipType
      })
    )
  }

  async function ensureEntity (input: {
    type: BibleEntityType
    name: string
    summary?: string
    description?: string
    sourceType?: string
    sourceId?: string
  }): Promise<string | null> {
    const key = bibleEntityDedupeKey(input.type, input.name)
    const existingId = entityByKey.get(key)
    if (existingId) {
      result.entitiesSkippedDuplicate++
      result.skipped.entities.push({
        type: input.type,
        name: input.name,
        reason: 'duplicate name in project'
      })
      if (input.sourceType === BIBLE_SEED_CHARACTER_SOURCE && input.sourceId) {
        characterIdToEntityId.set(input.sourceId, existingId)
      }
      return existingId
    }

    if (dryRun) {
      result.entitiesCreated++
      result.created.entities.push({
        type: input.type,
        name: input.name,
        status: BIBLE_SEED_ENTITY_STATUS
      })
      const fakeId = `dry-${input.type}-${normalizeBibleEntityNameKey(input.name)}`
      entityByKey.set(key, fakeId)
      if (input.sourceType === BIBLE_SEED_CHARACTER_SOURCE && input.sourceId) {
        characterIdToEntityId.set(input.sourceId, fakeId)
      }
      return fakeId
    }

    const created = await pb.collection('bible_entities').create({
      owned_by: userId,
      project: projectId,
      entity_type: input.type,
      name: input.name.trim().slice(0, 500),
      summary: (input.summary || '').slice(0, 5000),
      description: (input.description || '').slice(0, 50_000),
      status: BIBLE_SEED_ENTITY_STATUS,
      source_type: input.sourceType || BIBLE_SEED_SOURCE_TYPE,
      source_id: input.sourceId || '',
      actor_type: 'system',
      actor_id: 'project_seed'
    })
    const mapped = pbRecordToBibleEntity(created as Parameters<typeof pbRecordToBibleEntity>[0])
    entityByKey.set(key, mapped.id)
    if (input.sourceType === BIBLE_SEED_CHARACTER_SOURCE && input.sourceId) {
      characterIdToEntityId.set(input.sourceId, mapped.id)
    }
    result.entitiesCreated++
    result.created.entities.push({
      type: input.type,
      name: input.name,
      status: BIBLE_SEED_ENTITY_STATUS
    })
    return mapped.id
  }

  async function ensureFact (entityId: string, entityName: string, statement: string, factType: string) {
    const stmt = statement.trim().slice(0, 10_000)
    if (!stmt) return
    const fKey = `${entityId}:${normalizeBibleFactStatementKey(stmt)}`
    if (factKeys.has(fKey)) {
      result.factsSkippedDuplicate++
      return
    }
    if (dryRun) {
      result.factsCreated++
      result.created.facts.push({
        entityName,
        statement: stmt,
        status: BIBLE_SEED_FACT_STATUS
      })
      factKeys.add(fKey)
      return
    }
    await pb.collection('bible_facts').create({
      owned_by: userId,
      project: projectId,
      entity: entityId,
      fact_type: factType,
      statement: stmt,
      status: BIBLE_SEED_FACT_STATUS,
      source_type: BIBLE_SEED_SOURCE_TYPE,
      source_id: '',
      actor_type: 'system',
      actor_id: 'project_seed'
    })
    factKeys.add(fKey)
    result.factsCreated++
    result.created.facts.push({
      entityName,
      statement: stmt,
      status: BIBLE_SEED_FACT_STATUS
    })
  }

  async function ensureRelationship (input: {
    fromType: string
    fromId: string
    toType: string
    toId: string
    relationshipType: string
    summary: string
  }) {
    const rKey = bibleRelationshipDedupeKey(input)
    if (relKeys.has(rKey)) {
      result.relationshipsSkippedDuplicate++
      result.skipped.relationships.push({ summary: input.summary, reason: 'already exists' })
      return
    }
    if (dryRun) {
      result.relationshipsCreated++
      result.created.relationships.push({
        summary: input.summary,
        status: BIBLE_SEED_RELATIONSHIP_STATUS
      })
      relKeys.add(rKey)
      return
    }
    await pb.collection('bible_relationships').create({
      owned_by: userId,
      project: projectId,
      from_type: input.fromType,
      from_id: input.fromId,
      to_type: input.toType,
      to_id: input.toId,
      relationship_type: input.relationshipType,
      status: BIBLE_SEED_RELATIONSHIP_STATUS,
      source_type: BIBLE_SEED_SOURCE_TYPE,
      actor_type: 'system',
      actor_id: 'project_seed'
    })
    relKeys.add(rKey)
    result.relationshipsCreated++
    result.created.relationships.push({
      summary: input.summary,
      status: BIBLE_SEED_RELATIONSHIP_STATUS
    })
  }

  for (const c of characters) {
    if (!c.name.trim()) {
      result.unsupported.push('Skipped character row with empty name')
      continue
    }
    const hadKey = entityByKey.has(bibleEntityDedupeKey('character', c.name))
    const entityId = await ensureEntity({
      type: 'character',
      name: c.name,
      summary: buildCharacterSummary(c),
      description: buildCharacterDescription(c),
      sourceType: BIBLE_SEED_CHARACTER_SOURCE,
      sourceId: c.id
    })
    if (!entityId || hadKey) continue

    for (const spec of CHARACTER_FACT_FIELDS) {
      const value = c[spec.key]
      if (typeof value !== 'string' || !value.trim()) continue
      await ensureFact(entityId, c.name, `${spec.prefix}: ${value.trim()}`, spec.factType)
    }
  }

  const locationNames = new Set<string>()
  for (const scene of scenes) {
    const loc = extractLocationFromSceneHeading(scene.heading)
    if (!loc) continue
    const norm = normalizeBibleEntityNameKey(loc)
    if (locationNames.has(norm)) continue
    locationNames.add(norm)
    await ensureEntity({
      type: 'location',
      name: loc,
      summary: scene.summary.slice(0, 5000),
      description: `Derived from scene heading: ${scene.heading}`.slice(0, 50_000),
      sourceType: BIBLE_SEED_SOURCE_TYPE,
      sourceId: scene.id
    })
  }

  for (const row of assetRows) {
    const structured = structuredMetadataEntity(assetMeta(row))
    if (!structured) continue
    await ensureEntity({
      type: structured.type,
      name: structured.name,
      summary: typeof row.title === 'string' ? row.title : '',
      sourceType: BIBLE_SEED_SOURCE_TYPE,
      sourceId: String(row.id || '')
    })
  }

  for (const scene of scenes) {
    const sceneText = [scene.heading, scene.summary, scene.body].filter(Boolean).join('\n')
    if (!sceneText.trim()) continue
    for (const c of characters) {
      if (!c.name.trim()) continue
      if (!castNameAppearsInText(c.name, sceneText)) continue
      const eid = characterIdToEntityId.get(c.id)
      if (!eid) {
        result.unsupported.push(`Could not link ${c.name} to scene — no bible entity id`)
        continue
      }
      await ensureRelationship({
        fromType: 'bible_entity',
        fromId: eid,
        toType: 'scene',
        toId: scene.id,
        relationshipType: 'appears_in',
        summary: `${c.name} appears_in ${scene.heading}`
      })
    }
  }

  for (const shot of shots) {
    if (!shot.id || !shot.sceneId) {
      result.unsupported.push(`Skipped shot without scene link: ${shot.title || shot.id}`)
      continue
    }
    await ensureRelationship({
      fromType: 'shot',
      fromId: shot.id,
      toType: 'scene',
      toId: shot.sceneId,
      relationshipType: 'belongs_to',
      summary: `Shot “${shot.title || shot.id}” belongs_to scene`
    })
  }

  for (const row of assetRows) {
    const assetId = String(row.id || '')
    if (!assetId) continue
    const meta = assetMeta(row)
    const characterId = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    const sceneId = typeof meta.scene_id === 'string' ? meta.scene_id.trim() : ''

    if (characterId) {
      const entityId = characterIdToEntityId.get(characterId)
      if (entityId) {
        await ensureRelationship({
          fromType: 'asset',
          fromId: assetId,
          toType: 'bible_entity',
          toId: entityId,
          relationshipType: 'depicts',
          summary: `Asset depicts character (${typeof row.title === 'string' ? row.title : assetId})`
        })
      } else {
        result.unsupported.push(`Asset ${assetId} has character_id but no matching bible entity`)
      }
    }

    if (sceneId && scenes.some((s) => s.id === sceneId)) {
      await ensureRelationship({
        fromType: 'asset',
        fromId: assetId,
        toType: 'scene',
        toId: sceneId,
        relationshipType: 'depicts',
        summary: `Asset depicts scene (${typeof row.title === 'string' ? row.title : assetId})`
      })
    } else if (sceneId) {
      result.unsupported.push(`Asset ${assetId} references unknown scene_id`)
    }
  }

  if (!characters.length && !scenes.length) {
    result.unsupported.push('No characters or scenes found to seed from')
  }

  return result
}

async function loadCollection (
  pb: PocketBase,
  collection: string,
  filter: string,
  projectIdOnRow?: (row: Record<string, unknown>) => string
): Promise<Record<string, unknown>[]> {
  try {
    return (await pb.collection(collection).getFullList({
      filter,
      batch: 5000
    })) as Record<string, unknown>[]
  } catch {
    if (!projectIdOnRow) return []
    try {
      const all = (await pb.collection(collection).getFullList({ batch: 5000 })) as Record<
        string,
        unknown
      >[]
      const projectId = filter.match(/project="([^"]+)"/)?.[1] || ''
      return all.filter((r) => projectIdOnRow(r) === projectId)
    } catch {
      return []
    }
  }
}
