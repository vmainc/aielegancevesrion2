export const BIBLE_FACT_TYPES = [
  'appearance',
  'wardrobe',
  'location_state',
  'relationship',
  'timeline',
  'rule',
  'style',
  'negative_constraint',
  'provenance',
  'continuity'
] as const

export type BibleFactType = (typeof BIBLE_FACT_TYPES)[number]

export const BIBLE_FACT_STATUSES = [
  'active',
  'tentative',
  'draft',
  'needs_review',
  'contradicted',
  'retired'
] as const

export type BibleFactStatus = (typeof BIBLE_FACT_STATUSES)[number]

export const BIBLE_SCOPE_TYPES = [
  'project',
  'sequence',
  'scene',
  'shot',
  'asset',
  'timeline'
] as const

export type BibleScopeType = (typeof BIBLE_SCOPE_TYPES)[number]

/** Atomic attributable claim about an entity or the project. */
export interface BibleFact {
  id: string
  ownerId: string
  projectId: string
  entityId: string
  factType: string
  statement: string
  structuredValue: Record<string, unknown> | null
  scopeType: string
  scopeId: string
  status: BibleFactStatus
  confidence: number | null
  sourceType: string
  sourceId: string
  actorType: string
  actorId: string
  created: string
  updated: string
}
