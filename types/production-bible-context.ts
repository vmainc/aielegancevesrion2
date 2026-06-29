import type { BibleEntity } from '~/types/bible-entity'
import type { BibleFact } from '~/types/bible-fact'
import type { BibleRelationship } from '~/types/bible-relationship'

export interface ProductionBibleContextEntity {
  id: string
  type: string
  name: string
  summary: string
  status: string
  reason: string
  priority: number
}

export interface ProductionBibleContextFact {
  id: string
  entityId: string
  entityName: string
  statement: string
  factType: string
  confidence: number | null
  status: string
  reason: string
  priority: number
}

export interface ProductionBibleContextRelationship {
  id: string
  relationshipType: string
  summary: string
  status: string
  reason: string
  priority: number
}

export interface ProductionBibleContextDebug {
  entitiesConsidered: number
  factsConsidered: number
  relationshipsConsidered: number
  entitiesIncluded: number
  factsIncluded: number
  relationshipsIncluded: number
  maxItems: number
  tokenBudget: number
  estimatedChars: number
  inclusionLog: Array<{ kind: 'entity' | 'fact' | 'relationship'; id: string; reason: string }>
  /** Draft / needs_review facts skipped from prompt context (default resolver mode). */
  reviewFactsExcluded: number
  /** Present when review facts were excluded or when includeReviewFacts is enabled. */
  excludedReviewFacts?: Array<{ id: string; statement: string; status: string }>
}

/** Compact structured Production Bible slice for prompt assembly (read-only). */
export interface ProductionBibleResolvedContext {
  entities: ProductionBibleContextEntity[]
  facts: ProductionBibleContextFact[]
  relationships: ProductionBibleContextRelationship[]
  debug: ProductionBibleContextDebug
}

export interface ResolveProductionBibleContextOptions {
  sceneId?: string
  shotId?: string
  characterIds?: string[]
  entityIds?: string[]
  maxItems?: number
  /** Approximate character budget for serialized prompt block. */
  tokenBudget?: number
  /** When true, draft/needs_review facts may be included (debug / preview only). */
  includeReviewFacts?: boolean
}

export type ProductionBibleLoadSnapshot = {
  entities: BibleEntity[]
  facts: BibleFact[]
  relationships: BibleRelationship[]
}
