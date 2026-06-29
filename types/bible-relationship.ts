export const BIBLE_ENDPOINT_TYPES = [
  'bible_entity',
  'creative_character',
  'project',
  'scene',
  'shot',
  'asset',
  'timeline_clip',
  'generation_job'
] as const

export type BibleEndpointType = (typeof BIBLE_ENDPOINT_TYPES)[number]

export const BIBLE_RELATIONSHIP_STATUSES = [
  'active',
  'tentative',
  'retired',
  'contradicted'
] as const

export type BibleRelationshipStatus = (typeof BIBLE_RELATIONSHIP_STATUSES)[number]

/** Typed edge between two production or bible objects. */
export interface BibleRelationship {
  id: string
  ownerId: string
  projectId: string
  fromType: string
  fromId: string
  toType: string
  toId: string
  relationshipType: string
  role: string
  strength: number | null
  status: BibleRelationshipStatus
  sourceType: string
  sourceId: string
  actorType: string
  actorId: string
  created: string
  updated: string
}
