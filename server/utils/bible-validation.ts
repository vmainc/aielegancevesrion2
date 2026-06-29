import { createError } from 'h3'
import {
  BIBLE_ACTOR_TYPES,
  BIBLE_ENTITY_STATUSES,
  BIBLE_ENTITY_TYPES,
  type BibleActorType,
  type BibleEntityStatus,
  type BibleEntityType
} from '~/types/bible-entity'
import {
  BIBLE_FACT_STATUSES,
  BIBLE_SCOPE_TYPES,
  type BibleFactStatus,
  type BibleScopeType
} from '~/types/bible-fact'
import {
  BIBLE_ENDPOINT_TYPES,
  BIBLE_RELATIONSHIP_STATUSES,
  type BibleEndpointType,
  type BibleRelationshipStatus
} from '~/types/bible-relationship'

export const BIBLE_ENTITY_NAME_MAX = 500
export const BIBLE_ENTITY_SLUG_MAX = 200
export const BIBLE_ENTITY_SUMMARY_MAX = 5000
export const BIBLE_ENTITY_DESCRIPTION_MAX = 50_000
export const BIBLE_FACT_STATEMENT_MAX = 10_000
export const BIBLE_RELATIONSHIP_TYPE_MAX = 200
export const BIBLE_RELATIONSHIP_ROLE_MAX = 500
export const BIBLE_SOURCE_TYPE_MAX = 100
export const BIBLE_SOURCE_ID_MAX = 200
export const BIBLE_ACTOR_ID_MAX = 200

function isOneOf<T extends string> (value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value)
}

export function parseBibleEntityType (value: unknown, field = 'type'): BibleEntityType {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isOneOf(raw, BIBLE_ENTITY_TYPES)) {
    throw createError({
      statusCode: 400,
      message: `Invalid ${field}. Expected one of: ${BIBLE_ENTITY_TYPES.join(', ')}`
    })
  }
  return raw
}

export function parseBibleEntityStatus (value: unknown, fallback: BibleEntityStatus = 'active'): BibleEntityStatus {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback
  if (!isOneOf(raw, BIBLE_ENTITY_STATUSES)) {
    throw createError({
      statusCode: 400,
      message: `Invalid status. Expected one of: ${BIBLE_ENTITY_STATUSES.join(', ')}`
    })
  }
  return raw
}

export function parseBibleFactStatus (value: unknown, fallback: BibleFactStatus = 'active'): BibleFactStatus {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback
  if (!isOneOf(raw, BIBLE_FACT_STATUSES)) {
    throw createError({
      statusCode: 400,
      message: `Invalid status. Expected one of: ${BIBLE_FACT_STATUSES.join(', ')}`
    })
  }
  return raw
}

export function parseBibleRelationshipStatus (
  value: unknown,
  fallback: BibleRelationshipStatus = 'active'
): BibleRelationshipStatus {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback
  if (!isOneOf(raw, BIBLE_RELATIONSHIP_STATUSES)) {
    throw createError({
      statusCode: 400,
      message: `Invalid status. Expected one of: ${BIBLE_RELATIONSHIP_STATUSES.join(', ')}`
    })
  }
  return raw
}

export function parseBibleScopeType (value: unknown, fallback = ''): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback
  if (!isOneOf(raw, BIBLE_SCOPE_TYPES)) {
    throw createError({
      statusCode: 400,
      message: `Invalid scopeType. Expected one of: ${BIBLE_SCOPE_TYPES.join(', ')}`
    })
  }
  return raw as BibleScopeType
}

export function parseBibleEndpointType (value: unknown, field: 'fromType' | 'toType'): BibleEndpointType {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isOneOf(raw, BIBLE_ENDPOINT_TYPES)) {
    throw createError({
      statusCode: 400,
      message: `Invalid ${field}. Expected one of: ${BIBLE_ENDPOINT_TYPES.join(', ')}`
    })
  }
  return raw
}

export function parseBibleName (value: unknown, field = 'name'): string {
  const name = typeof value === 'string' ? value.trim().slice(0, BIBLE_ENTITY_NAME_MAX) : ''
  if (!name) {
    throw createError({ statusCode: 400, message: `${field} is required` })
  }
  return name
}

export function parseBibleFactStatement (value: unknown): string {
  const statement = typeof value === 'string' ? value.trim().slice(0, BIBLE_FACT_STATEMENT_MAX) : ''
  if (!statement) {
    throw createError({ statusCode: 400, message: 'statement is required' })
  }
  return statement
}

export function parseBibleEndpointId (value: unknown, field: 'fromId' | 'toId'): string {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id) {
    throw createError({ statusCode: 400, message: `${field} is required` })
  }
  return id.slice(0, BIBLE_SOURCE_ID_MAX)
}

export function parseBibleConfidence (value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(1, Math.max(0, Math.round(n * 1000) / 1000))
}

export function parseBibleActorType (value: unknown): BibleActorType | '' {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return ''
  if (!isOneOf(raw, BIBLE_ACTOR_TYPES)) {
    throw createError({
      statusCode: 400,
      message: `Invalid actorType. Expected one of: ${BIBLE_ACTOR_TYPES.join(', ')}`
    })
  }
  return raw
}

export function parseBibleAliases (value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().slice(0, BIBLE_ENTITY_NAME_MAX))
    .filter(Boolean)
}

export function parseBibleStructuredValue (value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, message: 'structuredValue must be a JSON object' })
  }
  return value as Record<string, unknown>
}

export function parseOptionalProjectId (bodyProjectId: unknown, routeProjectId: string, field = 'projectId'): void {
  if (bodyProjectId === undefined || bodyProjectId === null || bodyProjectId === '') return
  const raw = typeof bodyProjectId === 'string' ? bodyProjectId.trim() : String(bodyProjectId)
  if (raw && raw !== routeProjectId) {
    throw createError({
      statusCode: 400,
      message: `${field} must match the project in the URL`
    })
  }
}
