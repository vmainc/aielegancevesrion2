import type { BibleEntity, BibleEntityType } from '~/types/bible-entity'
import type { BibleRelationship } from '~/types/bible-relationship'
import { isTentativeBibleStatus } from '~/lib/bible-trust'

export type BibleTentativeItemKindFilter = 'all' | 'entity' | 'relationship'

export interface BibleTentativeItemFilters {
  kind: BibleTentativeItemKindFilter
  entityType: string
  relationshipType: string
  search: string
}

export const DEFAULT_BIBLE_TENTATIVE_ITEM_FILTERS: BibleTentativeItemFilters = {
  kind: 'all',
  entityType: 'all',
  relationshipType: 'all',
  search: ''
}

export type BibleTentativeReviewItemKind = 'entity' | 'relationship'

export interface BibleTentativeReviewItem {
  kind: BibleTentativeReviewItemKind
  id: string
  title: string
  detail: string
  entityType?: BibleEntityType
  relationshipType?: string
  status: string
}

export function tentativeReviewItemKey (item: Pick<BibleTentativeReviewItem, 'kind' | 'id'>): string {
  return `${item.kind}:${item.id}`
}

export function parseTentativeReviewItemKey (
  key: string
): { kind: BibleTentativeReviewItemKind; id: string } | null {
  const idx = key.indexOf(':')
  if (idx <= 0) return null
  const kind = key.slice(0, idx)
  const id = key.slice(idx + 1)
  if (!id) return null
  if (kind !== 'entity' && kind !== 'relationship') return null
  return { kind, id }
}

export function relationshipReviewLabel (
  r: BibleRelationship,
  entityNameById: Map<string, string>
): string {
  const label = (type: string, id: string): string => {
    if (type === 'bible_entity') {
      const name = entityNameById.get(id)
      return name ? `${name} (entity)` : `entity:${id.slice(0, 8)}…`
    }
    if (type === 'project') return 'project'
    return `${type}:${id.slice(0, 8)}…`
  }
  return `${r.relationshipType}: ${label(r.fromType, r.fromId)} → ${label(r.toType, r.toId)}`
}

export function buildTentativeReviewItems (
  entities: BibleEntity[],
  relationships: BibleRelationship[]
): BibleTentativeReviewItem[] {
  const entityNameById = new Map(entities.map((e) => [e.id, e.name]))
  const items: BibleTentativeReviewItem[] = []

  for (const e of entities) {
    if (!isTentativeBibleStatus(e.status)) continue
    items.push({
      kind: 'entity',
      id: e.id,
      title: e.name,
      detail: e.summary?.trim() || e.type,
      entityType: e.type,
      status: e.status
    })
  }

  for (const r of relationships) {
    if (!isTentativeBibleStatus(r.status)) continue
    items.push({
      kind: 'relationship',
      id: r.id,
      title: relationshipReviewLabel(r, entityNameById),
      detail: r.role?.trim() || `${r.fromType} → ${r.toType}`,
      relationshipType: r.relationshipType,
      status: r.status
    })
  }

  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'entity' ? -1 : 1
    return a.title.localeCompare(b.title)
  })

  return items
}

export function matchesTentativeItemFilters (
  item: BibleTentativeReviewItem,
  filters: BibleTentativeItemFilters
): boolean {
  if (filters.kind === 'entity' && item.kind !== 'entity') return false
  if (filters.kind === 'relationship' && item.kind !== 'relationship') return false
  if (
    filters.entityType &&
    filters.entityType !== 'all' &&
    item.kind === 'entity' &&
    item.entityType !== filters.entityType
  ) {
    return false
  }
  if (
    filters.relationshipType &&
    filters.relationshipType !== 'all' &&
    item.kind === 'relationship' &&
    item.relationshipType !== filters.relationshipType
  ) {
    return false
  }
  const q = filters.search.trim().toLowerCase()
  if (q) {
    const haystack = `${item.title} ${item.detail} ${item.entityType || ''} ${item.relationshipType || ''} ${item.kind}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }
  return true
}

export function filterTentativeReviewItems (
  items: BibleTentativeReviewItem[],
  filters: BibleTentativeItemFilters
): BibleTentativeReviewItem[] {
  return items.filter((item) => matchesTentativeItemFilters(item, filters))
}
