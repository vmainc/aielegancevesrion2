export const BIBLE_ENTITY_TYPES = [
  'character',
  'location',
  'prop',
  'creature',
  'species',
  'organization',
  'technology',
  'world_rule',
  'event',
  'style_rule',
  'concept'
] as const

export type BibleEntityType = (typeof BIBLE_ENTITY_TYPES)[number]

export const BIBLE_ENTITY_STATUSES = [
  'active',
  'tentative',
  'draft',
  'retired',
  'contradicted'
] as const

export type BibleEntityStatus = (typeof BIBLE_ENTITY_STATUSES)[number]

export const BIBLE_ACTOR_TYPES = ['user', 'ai', 'system'] as const
export type BibleActorType = (typeof BIBLE_ACTOR_TYPES)[number]

/** Canonical Production Bible entity — project-scoped universe object. */
export interface BibleEntity {
  id: string
  ownerId: string
  projectId: string
  type: BibleEntityType
  name: string
  slug: string
  aliases: string[]
  summary: string
  description: string
  status: BibleEntityStatus
  confidence: number | null
  sourceType: string
  sourceId: string
  actorType: BibleActorType | ''
  actorId: string
  created: string
  updated: string
}
