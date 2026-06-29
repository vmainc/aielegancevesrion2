import { CONTINUITY_BIBLE_FACT_TYPE, CONTINUITY_BIBLE_SOURCE_TYPE } from '~/lib/continuity-bible-fact'
import { BIBLE_SEED_SOURCE_TYPE } from '~/lib/bible-seed-normalize'
import type { BibleFact } from '~/types/bible-fact'

export type BiblePendingFactSourceFilter = 'all' | 'seed' | 'continuity' | 'other'
export type BiblePendingFactScopeFilter = 'all' | 'entity' | 'project'

export interface BiblePendingFactFilters {
  source: BiblePendingFactSourceFilter
  factType: string
  scope: BiblePendingFactScopeFilter
  search: string
}

export const DEFAULT_BIBLE_PENDING_FACT_FILTERS: BiblePendingFactFilters = {
  source: 'all',
  factType: 'all',
  scope: 'all',
  search: ''
}

export function biblePendingFactSourceCategory (
  fact: Pick<BibleFact, 'factType' | 'sourceType'>
): 'seed' | 'continuity' | 'other' {
  if (fact.factType === CONTINUITY_BIBLE_FACT_TYPE || fact.sourceType === CONTINUITY_BIBLE_SOURCE_TYPE) {
    return 'continuity'
  }
  if (fact.sourceType === BIBLE_SEED_SOURCE_TYPE) return 'seed'
  return 'other'
}

export function matchesPendingFactFilters (
  fact: BibleFact,
  filters: BiblePendingFactFilters
): boolean {
  if (filters.source !== 'all' && biblePendingFactSourceCategory(fact) !== filters.source) {
    return false
  }
  if (filters.factType && filters.factType !== 'all' && fact.factType !== filters.factType) {
    return false
  }
  if (filters.scope === 'entity' && !fact.entityId?.trim()) return false
  if (filters.scope === 'project' && fact.entityId?.trim()) return false
  const q = filters.search.trim().toLowerCase()
  if (q) {
    const haystack = `${fact.statement} ${fact.factType} ${fact.entityId} ${fact.scopeType}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }
  return true
}

export function filterPendingReviewFacts (
  facts: BibleFact[],
  filters: BiblePendingFactFilters
): BibleFact[] {
  return facts.filter((f) => matchesPendingFactFilters(f, filters))
}
