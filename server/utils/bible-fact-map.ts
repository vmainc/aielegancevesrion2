import type { BibleFact, BibleFactStatus } from '~/types/bible-fact'
import { bibleRelId } from '~/server/utils/bible-project-access'

type PbBibleFactRecord = {
  id: string
  owned_by?: string | { id?: string }
  owner?: string | { id?: string }
  user?: string | { id?: string }
  project?: string | { id?: string }
  entity?: string | { id?: string }
  fact_type?: string
  statement?: string
  structured_value?: unknown
  scope_type?: string
  scope_id?: string
  status?: string
  confidence?: number
  source_type?: string
  source_id?: string
  actor_type?: string
  actor_id?: string
  created?: string
  updated?: string
}

export function projectIdOnBibleFactRow (raw: Record<string, unknown>): string {
  return bibleRelId(raw.project as string | { id?: string } | undefined)
}

export function entityIdOnBibleFactRow (raw: Record<string, unknown>): string {
  return bibleRelId(raw.entity as string | { id?: string } | undefined)
}

function parseStructuredValue (value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function parseConfidence (value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function pbRecordToBibleFact (r: PbBibleFactRecord): BibleFact {
  return {
    id: r.id,
    ownerId: bibleRelId(r.owned_by || r.owner || r.user),
    projectId: bibleRelId(r.project),
    entityId: bibleRelId(r.entity),
    factType: String(r.fact_type || ''),
    statement: String(r.statement || ''),
    structuredValue: parseStructuredValue(r.structured_value),
    scopeType: String(r.scope_type || ''),
    scopeId: String(r.scope_id || ''),
    status: String(r.status || 'active') as BibleFactStatus,
    confidence: parseConfidence(r.confidence),
    sourceType: String(r.source_type || ''),
    sourceId: String(r.source_id || ''),
    actorType: String(r.actor_type || ''),
    actorId: String(r.actor_id || ''),
    created: String(r.created || ''),
    updated: String(r.updated || '')
  }
}
