import type { BibleEntity, BibleEntityStatus, BibleEntityType } from '~/types/bible-entity'
import { bibleRelId } from '~/server/utils/bible-project-access'

type PbBibleEntityRecord = {
  id: string
  owned_by?: string | { id?: string }
  owner?: string | { id?: string }
  user?: string | { id?: string }
  project?: string | { id?: string }
  entity_type?: string
  name?: string
  slug?: string
  aliases?: unknown
  summary?: string
  description?: string
  status?: string
  confidence?: number
  source_type?: string
  source_id?: string
  actor_type?: string
  actor_id?: string
  created?: string
  updated?: string
}

export function projectIdOnBibleEntityRow (raw: Record<string, unknown>): string {
  return bibleRelId(raw.project as string | { id?: string } | undefined)
}

function parseAliases (value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function parseConfidence (value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function pbRecordToBibleEntity (r: PbBibleEntityRecord): BibleEntity {
  const actorType = String(r.actor_type || '')
  return {
    id: r.id,
    ownerId: bibleRelId(r.owned_by || r.owner || r.user),
    projectId: bibleRelId(r.project),
    type: String(r.entity_type || 'concept') as BibleEntityType,
    name: String(r.name || ''),
    slug: String(r.slug || ''),
    aliases: parseAliases(r.aliases),
    summary: String(r.summary || ''),
    description: String(r.description || ''),
    status: String(r.status || 'active') as BibleEntityStatus,
    confidence: parseConfidence(r.confidence),
    sourceType: String(r.source_type || ''),
    sourceId: String(r.source_id || ''),
    actorType: actorType === 'user' || actorType === 'ai' || actorType === 'system' ? actorType : '',
    actorId: String(r.actor_id || ''),
    created: String(r.created || ''),
    updated: String(r.updated || '')
  }
}
