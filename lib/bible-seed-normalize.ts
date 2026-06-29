import type { BibleEntityType } from '~/types/bible-entity'

/** Normalize entity names for duplicate detection within a project + type. */
export function normalizeBibleEntityNameKey (name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, ' ')
}

export function bibleEntityDedupeKey (type: BibleEntityType | string, name: string): string {
  return `${type}:${normalizeBibleEntityNameKey(name)}`
}

export function normalizeBibleFactStatementKey (statement: string): string {
  return statement.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function bibleRelationshipDedupeKey (input: {
  fromType: string
  fromId: string
  toType: string
  toId: string
  relationshipType: string
}): string {
  return [
    input.fromType.trim().toLowerCase(),
    input.fromId.trim(),
    input.toType.trim().toLowerCase(),
    input.toId.trim(),
    input.relationshipType.trim().toLowerCase()
  ].join('|')
}

export const BIBLE_SEED_SOURCE_TYPE = 'project_seed'
export const BIBLE_SEED_CHARACTER_SOURCE = 'creative_character'

/** Default statuses for rows created by project seed (PASS 13 — review before prompt canon). */
export const BIBLE_SEED_ENTITY_STATUS = 'tentative' as const
export const BIBLE_SEED_FACT_STATUS = 'needs_review' as const
export const BIBLE_SEED_RELATIONSHIP_STATUS = 'tentative' as const
