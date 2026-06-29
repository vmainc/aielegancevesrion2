import type { BibleRelationship, BibleRelationshipStatus } from '~/types/bible-relationship'
import { bibleRelId } from '~/server/utils/bible-project-access'

type PbBibleRelationshipRecord = {
  id: string
  owned_by?: string | { id?: string }
  owner?: string | { id?: string }
  user?: string | { id?: string }
  project?: string | { id?: string }
  from_type?: string
  from_id?: string
  to_type?: string
  to_id?: string
  relationship_type?: string
  role?: string
  strength?: number
  status?: string
  source_type?: string
  source_id?: string
  actor_type?: string
  actor_id?: string
  created?: string
  updated?: string
}

export function projectIdOnBibleRelationshipRow (raw: Record<string, unknown>): string {
  return bibleRelId(raw.project as string | { id?: string } | undefined)
}

function parseStrength (value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function pbRecordToBibleRelationship (r: PbBibleRelationshipRecord): BibleRelationship {
  return {
    id: r.id,
    ownerId: bibleRelId(r.owned_by || r.owner || r.user),
    projectId: bibleRelId(r.project),
    fromType: String(r.from_type || ''),
    fromId: String(r.from_id || ''),
    toType: String(r.to_type || ''),
    toId: String(r.to_id || ''),
    relationshipType: String(r.relationship_type || ''),
    role: String(r.role || ''),
    strength: parseStrength(r.strength),
    status: String(r.status || 'active') as BibleRelationshipStatus,
    sourceType: String(r.source_type || ''),
    sourceId: String(r.source_id || ''),
    actorType: String(r.actor_type || ''),
    actorId: String(r.actor_id || ''),
    created: String(r.created || ''),
    updated: String(r.updated || '')
  }
}
