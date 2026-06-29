import type PocketBase from 'pocketbase'
import {
  buildCastBibleBridgeMaps,
  castBibleConfidencePriority
} from '~/lib/bible-cast-bridge'
import { extractLocationFromSceneHeading } from '~/lib/bible-scene-location'
import { isBibleFactTrustedForContext, isBibleEntityTrustedForContext, isBibleRelationshipTrustedForContext, bibleContextTrustPriorityBoost } from '~/lib/bible-trust'
import { normalizeBibleEntityNameKey } from '~/lib/bible-seed-normalize'
import { estimateProductionBibleContextChars } from '~/lib/format-production-bible-prompt-block'
import { pbRecordToCreativeCharacter } from '~/server/utils/creative-character-map'
import { pbRecordToBibleEntity, projectIdOnBibleEntityRow } from '~/server/utils/bible-entity-map'
import { pbRecordToBibleFact, projectIdOnBibleFactRow } from '~/server/utils/bible-fact-map'
import {
  pbRecordToBibleRelationship,
  projectIdOnBibleRelationshipRow
} from '~/server/utils/bible-relationship-map'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleFact } from '~/types/bible-fact'
import type { BibleRelationship } from '~/types/bible-relationship'
import type {
  ProductionBibleContextDebug,
  ProductionBibleContextEntity,
  ProductionBibleContextFact,
  ProductionBibleContextRelationship,
  ProductionBibleResolvedContext,
  ResolveProductionBibleContextOptions
} from '~/types/production-bible-context'

const DEFAULT_MAX_ITEMS = 24
const DEFAULT_TOKEN_BUDGET = 1400

type Candidate =
  | { kind: 'entity'; id: string; priority: number; reason: string }
  | { kind: 'fact'; id: string; priority: number; reason: string }
  | { kind: 'relationship'; id: string; priority: number; reason: string }

function factConfidenceScore (fact: BibleFact, includeReviewFacts: boolean): number {
  if (!isBibleFactTrustedForContext(fact, { includeReviewFacts })) return -1
  const c = fact.confidence
  const base = typeof c === 'number' && Number.isFinite(c) ? c : 0.5
  return base + bibleContextTrustPriorityBoost(fact.status)
}

function entityConfidenceScore (entity: BibleEntity): number {
  if (!isBibleEntityTrustedForContext(entity)) return -1
  const c = entity.confidence
  const base = typeof c === 'number' && Number.isFinite(c) ? c : 0.5
  return base + bibleContextTrustPriorityBoost(entity.status)
}

function entityLabel (entities: Map<string, BibleEntity>, type: string, id: string): string {
  if (type === 'bible_entity') {
    const e = entities.get(id)
    return e ? `${e.name} (entity)` : `entity:${id.slice(0, 8)}`
  }
  if (type === 'scene') return `scene:${id.slice(0, 8)}`
  if (type === 'shot') return `shot:${id.slice(0, 8)}`
  if (type === 'asset') return `asset:${id.slice(0, 8)}`
  if (type === 'project') return 'project'
  return `${type}:${id.slice(0, 12)}`
}

function relationshipSummary (rel: BibleRelationship, entities: Map<string, BibleEntity>): string {
  const from = entityLabel(entities, rel.fromType, rel.fromId)
  const to = entityLabel(entities, rel.toType, rel.toId)
  return `${rel.relationshipType}: ${from} → ${to}`
}

async function loadBibleSnapshot (
  pb: PocketBase,
  projectId: string
): Promise<{ entities: BibleEntity[]; facts: BibleFact[]; relationships: BibleRelationship[] }> {
  const [entityRows, factRows, relRows] = await Promise.all([
    loadRows(pb, 'bible_entities', projectId, projectIdOnBibleEntityRow),
    loadRows(pb, 'bible_facts', projectId, projectIdOnBibleFactRow),
    loadRows(pb, 'bible_relationships', projectId, projectIdOnBibleRelationshipRow)
  ])
  return {
    entities: entityRows.map((r) => pbRecordToBibleEntity(r as Parameters<typeof pbRecordToBibleEntity>[0])),
    facts: factRows.map((r) => pbRecordToBibleFact(r as Parameters<typeof pbRecordToBibleFact>[0])),
    relationships: relRows.map((r) =>
      pbRecordToBibleRelationship(r as Parameters<typeof pbRecordToBibleRelationship>[0])
    )
  }
}

async function loadRows (
  pb: PocketBase,
  collection: string,
  projectId: string,
  projectIdOnRow?: (row: Record<string, unknown>) => string
): Promise<Record<string, unknown>[]> {
  try {
    return (await pb.collection(collection).getFullList({
      filter: `project="${projectId}"`,
      batch: 2000
    })) as Record<string, unknown>[]
  } catch {
    if (!projectIdOnRow) return []
    try {
      const all = (await pb.collection(collection).getFullList({ batch: 2000 })) as Record<
        string,
        unknown
      >[]
      return all.filter((r) => projectIdOnRow(r) === projectId)
    } catch {
      return []
    }
  }
}

async function loadCastCharactersForBridge (
  pb: PocketBase,
  projectId: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const rows = await pb.collection('creative_characters').getFullList({
      filter: `project="${projectId}"`,
      batch: 200
    })
    return rows.map((row) => {
      const c = pbRecordToCreativeCharacter(row as Record<string, unknown>)
      return { id: c.id, name: c.name }
    })
  } catch {
    return []
  }
}

/**
 * Read-only Production Bible context for prompt assembly.
 * Never writes to bible collections.
 */
export async function resolveProductionBibleContext (
  pb: PocketBase,
  projectId: string,
  options: ResolveProductionBibleContextOptions = {}
): Promise<ProductionBibleResolvedContext> {
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS
  const tokenBudget = options.tokenBudget ?? DEFAULT_TOKEN_BUDGET
  const includeReviewFacts = options.includeReviewFacts ?? false
  const sceneId = options.sceneId?.trim() || ''
  const shotId = options.shotId?.trim() || ''
  const explicitEntityIds = new Set((options.entityIds || []).map((id) => id.trim()).filter(Boolean))
  const characterIds = new Set((options.characterIds || []).map((id) => id.trim()).filter(Boolean))

  const { entities, facts, relationships } = await loadBibleSnapshot(pb, projectId)
  const entityById = new Map(entities.map((e) => [e.id, e]))
  const factById = new Map(facts.map((f) => [f.id, f]))
  const relById = new Map(relationships.map((r) => [r.id, r]))
  const castCharacters = await loadCastCharactersForBridge(pb, projectId)
  const castBridge = buildCastBibleBridgeMaps(entities, castCharacters, relationships)

  const excludedReviewFacts: ProductionBibleContextDebug['excludedReviewFacts'] = []
  const excludedReviewIds = new Set<string>()
  const trackExcludedReview = (fact: BibleFact) => {
    if (includeReviewFacts || excludedReviewIds.has(fact.id)) return
    excludedReviewIds.add(fact.id)
    excludedReviewFacts.push({
      id: fact.id,
      statement: fact.statement.slice(0, 200),
      status: fact.status
    })
  }

  const candidates = new Map<string, Candidate>()
  const add = (c: Candidate) => {
    const key = `${c.kind}:${c.id}`
    const prev = candidates.get(key)
    if (!prev || c.priority > prev.priority) candidates.set(key, c)
  }

  for (const id of explicitEntityIds) {
    const e = entityById.get(id)
    if (e && isBibleEntityTrustedForContext(e)) {
      add({
        kind: 'entity',
        id,
        priority: 100 + entityConfidenceScore(e) * 5,
        reason: 'explicit entityIds option'
      })
    }
  }

  for (const cid of characterIds) {
    const link = castBridge.characterToEntity.get(cid)
    if (!link || link.confidence === 'ambiguous') continue
    const e = entityById.get(link.entityId)
    if (e && isBibleEntityTrustedForContext(e)) {
      add({
        kind: 'entity',
        id: link.entityId,
        priority: castBibleConfidencePriority(link.confidence) + entityConfidenceScore(e) * 5,
        reason: `characterIds cast bridge (${link.confidence})`
      })
    }
  }

  let sceneHeading = ''
  if (sceneId) {
    try {
      const scene = await pb.collection('creative_scenes').getOne(sceneId)
      sceneHeading = String(scene.heading || '')
    } catch {
      /* ignore */
    }
  }

  for (const rel of relationships) {
    if (!isBibleRelationshipTrustedForContext(rel)) continue

    const touchesScene =
      sceneId &&
      ((rel.toType === 'scene' && rel.toId === sceneId) ||
        (rel.fromType === 'scene' && rel.fromId === sceneId))
    const touchesShot =
      shotId &&
      ((rel.toType === 'shot' && rel.toId === shotId) ||
        (rel.fromType === 'shot' && rel.fromId === shotId))

    if (touchesScene || touchesShot) {
      add({
        kind: 'relationship',
        id: rel.id,
        priority: (touchesShot ? 88 : 82) + bibleContextTrustPriorityBoost(rel.status) * 5,
        reason: touchesShot ? 'relationship involves shotId' : 'relationship involves sceneId'
      })
    }

    if (
      sceneId &&
      rel.relationshipType === 'appears_in' &&
      rel.toType === 'scene' &&
      rel.toId === sceneId &&
      rel.fromType === 'bible_entity'
    ) {
      const ent = entityById.get(rel.fromId)
      if (ent && isBibleEntityTrustedForContext(ent)) {
        add({
          kind: 'entity',
          id: rel.fromId,
          priority: 90 + entityConfidenceScore(ent) * 5,
          reason: 'character appears_in scene (relationship)'
        })
      }
    }

    if (
      shotId &&
      rel.relationshipType === 'belongs_to' &&
      rel.fromType === 'shot' &&
      rel.fromId === shotId &&
      rel.toType === 'scene'
    ) {
      add({
        kind: 'relationship',
        id: rel.id,
        priority: 86 + bibleContextTrustPriorityBoost(rel.status) * 5,
        reason: 'shot belongs_to scene'
      })
    }
  }

  if (sceneId && sceneHeading) {
    const locName = extractLocationFromSceneHeading(sceneHeading)
    if (locName) {
      const locKey = normalizeBibleEntityNameKey(locName)
      const locEntity = entities.find(
        (e) => e.type === 'location' && normalizeBibleEntityNameKey(e.name) === locKey
      )
      if (locEntity && isBibleEntityTrustedForContext(locEntity)) {
        add({
          kind: 'entity',
          id: locEntity.id,
          priority: 78 + entityConfidenceScore(locEntity) * 5,
          reason: 'location matches scene heading slug'
        })
      }
    }
  }

  for (const e of entities) {
    if (!isBibleEntityTrustedForContext(e)) continue
    if (e.type === 'world_rule' || e.type === 'style_rule') {
      add({
        kind: 'entity',
        id: e.id,
        priority: 65 + entityConfidenceScore(e) * 5,
        reason: `project-level ${e.type}`
      })
    }
  }

  for (const fact of facts) {
    if (!isBibleFactTrustedForContext(fact, { includeReviewFacts })) {
      if (fact.status === 'draft' || fact.status === 'needs_review') trackExcludedReview(fact)
      continue
    }
    if (fact.scopeType === 'project') {
      const score = factConfidenceScore(fact, includeReviewFacts)
      if (score < 0) continue
      add({
        kind: 'fact',
        id: fact.id,
        priority: 60 + score * 10,
        reason: 'project-scoped fact'
      })
    }
  }

  const entityCandidates = [...candidates.values()]
    .filter((c): c is Extract<Candidate, { kind: 'entity' }> => c.kind === 'entity')
    .sort((a, b) => b.priority - a.priority)

  for (const ec of entityCandidates) {
    for (const fact of facts) {
      if (fact.entityId !== ec.id) continue
      if (!isBibleFactTrustedForContext(fact, { includeReviewFacts })) {
        if (fact.status === 'draft' || fact.status === 'needs_review') trackExcludedReview(fact)
        continue
      }
      const score = factConfidenceScore(fact, includeReviewFacts)
      add({
        kind: 'fact',
        id: fact.id,
        priority: 72 + score * 12,
        reason: `fact linked to entity ${entityById.get(ec.id)?.name || ec.id}`
      })
    }
  }

  const sorted = [...candidates.values()].sort((a, b) => b.priority - a.priority)

  const pickedEntities: ProductionBibleContextEntity[] = []
  const pickedFacts: ProductionBibleContextFact[] = []
  const pickedRels: ProductionBibleContextRelationship[] = []
  const inclusionLog: ProductionBibleContextDebug['inclusionLog'] = []
  const pickedKeys = new Set<string>()

  for (const c of sorted) {
    if (pickedKeys.size >= maxItems) break

    const tentative: ProductionBibleResolvedContext = {
      entities: pickedEntities,
      facts: pickedFacts,
      relationships: pickedRels,
      debug: emptyDebug(entities.length, facts.length, relationships.length, maxItems, tokenBudget)
    }

    if (c.kind === 'entity') {
      const e = entityById.get(c.id)
      if (!e || !isBibleEntityTrustedForContext(e)) continue
      tentative.entities = [
        ...pickedEntities,
        {
          id: e.id,
          type: e.type,
          name: e.name,
          summary: e.summary || e.description.slice(0, 500),
          status: e.status,
          reason: c.reason,
          priority: c.priority
        }
      ]
    } else if (c.kind === 'fact') {
      const f = factById.get(c.id)
      if (!f || !isBibleFactTrustedForContext(f, { includeReviewFacts })) continue
      const ent = f.entityId ? entityById.get(f.entityId) : undefined
      tentative.facts = [
        ...pickedFacts,
        {
          id: f.id,
          entityId: f.entityId,
          entityName: ent?.name || '',
          statement: f.statement,
          factType: f.factType,
          confidence: f.confidence,
          status: f.status,
          reason: c.reason,
          priority: c.priority
        }
      ]
    } else {
      const r = relById.get(c.id)
      if (!r || !isBibleRelationshipTrustedForContext(r)) continue
      tentative.relationships = [
        ...pickedRels,
        {
          id: r.id,
          relationshipType: r.relationshipType,
          summary: relationshipSummary(r, entityById),
          status: r.status,
          reason: c.reason,
          priority: c.priority
        }
      ]
    }

    if (estimateProductionBibleContextChars(tentative) > tokenBudget && pickedKeys.size > 0) {
      continue
    }

    const key = `${c.kind}:${c.id}`
    if (pickedKeys.has(key)) continue
    pickedKeys.add(key)
    inclusionLog.push({ kind: c.kind, id: c.id, reason: c.reason })

    if (c.kind === 'entity') {
      pickedEntities.push(tentative.entities[tentative.entities.length - 1]!)
    } else if (c.kind === 'fact') {
      pickedFacts.push(tentative.facts[tentative.facts.length - 1]!)
    } else {
      pickedRels.push(tentative.relationships[tentative.relationships.length - 1]!)
    }
  }

  const charBudget = estimateProductionBibleContextChars({
    entities: pickedEntities,
    facts: pickedFacts,
    relationships: pickedRels,
    debug: emptyDebug(entities.length, facts.length, relationships.length, maxItems, tokenBudget)
  })

  return {
    entities: pickedEntities,
    facts: pickedFacts,
    relationships: pickedRels,
    debug: {
      entitiesConsidered: entities.length,
      factsConsidered: facts.length,
      relationshipsConsidered: relationships.length,
      entitiesIncluded: pickedEntities.length,
      factsIncluded: pickedFacts.length,
      relationshipsIncluded: pickedRels.length,
      maxItems,
      tokenBudget,
      estimatedChars: charBudget,
      inclusionLog,
      reviewFactsExcluded: excludedReviewFacts.length,
      excludedReviewFacts: excludedReviewFacts.length ? excludedReviewFacts.slice(0, 20) : undefined
    }
  }
}

function emptyDebug (
  entitiesConsidered: number,
  factsConsidered: number,
  relationshipsConsidered: number,
  maxItems: number,
  tokenBudget: number
): ProductionBibleResolvedContext['debug'] {
  return {
    entitiesConsidered,
    factsConsidered,
    relationshipsConsidered,
    entitiesIncluded: 0,
    factsIncluded: 0,
    relationshipsIncluded: 0,
    maxItems,
    tokenBudget,
    estimatedChars: 0,
    inclusionLog: [],
    reviewFactsExcluded: 0
  }
}

type ProductionBibleContextDebug = import('~/types/production-bible-context').ProductionBibleContextDebug
