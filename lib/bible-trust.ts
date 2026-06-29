import type { BibleEntity } from '~/types/bible-entity'
import type { BibleFact, BibleFactStatus } from '~/types/bible-fact'
import type { BibleRelationship } from '~/types/bible-relationship'
import { CONTINUITY_BIBLE_FACT_TYPE, CONTINUITY_BIBLE_SOURCE_TYPE } from '~/lib/continuity-bible-fact'
import { BIBLE_SEED_SOURCE_TYPE } from '~/lib/bible-seed-normalize'

/** Statuses that require human review before prompt context inclusion (facts). */
export const BIBLE_FACT_PENDING_REVIEW_STATUSES = ['draft', 'needs_review'] as const
export type BibleFactPendingReviewStatus = (typeof BIBLE_FACT_PENDING_REVIEW_STATUSES)[number]

export const BIBLE_FACT_TRUSTED_CONTEXT_STATUSES = ['active', 'tentative'] as const

export const BIBLE_ENTITY_TRUSTED_CONTEXT_STATUSES = ['active', 'tentative'] as const
export const BIBLE_RELATIONSHIP_TRUSTED_CONTEXT_STATUSES = ['active', 'tentative'] as const

export const BIBLE_EXCLUDED_CONTEXT_STATUSES = ['retired', 'contradicted'] as const

export function isExcludedBibleStatus (status: string): boolean {
  return (BIBLE_EXCLUDED_CONTEXT_STATUSES as readonly string[]).includes(status)
}

export function isTentativeBibleStatus (status: string): boolean {
  return status === 'tentative'
}

export function isBibleFactPendingReview (status: string): status is BibleFactPendingReviewStatus {
  return (BIBLE_FACT_PENDING_REVIEW_STATUSES as readonly string[]).includes(status)
}

export function isBibleFactTrustedForContext (
  fact: Pick<BibleFact, 'status'>,
  options?: { includeReviewFacts?: boolean }
): boolean {
  if (isExcludedBibleStatus(fact.status)) return false
  if (!options?.includeReviewFacts && isBibleFactPendingReview(fact.status)) return false
  return (BIBLE_FACT_TRUSTED_CONTEXT_STATUSES as readonly string[]).includes(fact.status)
}

export function isBibleEntityTrustedForContext (entity: Pick<BibleEntity, 'status'>): boolean {
  if (isExcludedBibleStatus(entity.status)) return false
  if (entity.status === 'draft') return false
  return (BIBLE_ENTITY_TRUSTED_CONTEXT_STATUSES as readonly string[]).includes(entity.status)
}

export function isBibleRelationshipTrustedForContext (
  relationship: Pick<BibleRelationship, 'status'>
): boolean {
  if (isExcludedBibleStatus(relationship.status)) return false
  return (BIBLE_RELATIONSHIP_TRUSTED_CONTEXT_STATUSES as readonly string[]).includes(
    relationship.status
  )
}

/** Slight priority boost for approved/active rows in context selection. */
export function bibleContextTrustPriorityBoost (status: string): number {
  return status === 'active' ? 0.1 : 0
}

export function isAiOriginatedBibleFact (
  fact: Pick<BibleFact, 'factType' | 'sourceType' | 'actorType'>
): boolean {
  if (fact.factType === CONTINUITY_BIBLE_FACT_TYPE) return true
  if (fact.sourceType === CONTINUITY_BIBLE_SOURCE_TYPE) return true
  if (fact.sourceType === BIBLE_SEED_SOURCE_TYPE) return true
  if (fact.actorType === 'ai' || fact.actorType === 'system') return true
  return false
}

export function defaultUserAuthoredFactStatus (): BibleFactStatus {
  return 'active'
}

export function bibleStatusDisplayLabel (status: string): string {
  switch (status) {
    case 'active':
      return 'Approved / Active'
    case 'draft':
      return 'Draft'
    case 'needs_review':
      return 'Needs Review'
    case 'tentative':
      return 'Tentative'
    case 'retired':
      return 'Retired'
    case 'contradicted':
      return 'Contradicted'
    default:
      return status
  }
}

export function bibleStatusBadgeClass (status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800'
    case 'draft':
      return 'bg-slate-100 text-slate-700'
    case 'needs_review':
      return 'bg-amber-100 text-amber-900'
    case 'tentative':
      return 'bg-sky-100 text-sky-800'
    case 'retired':
      return 'bg-gray-200 text-gray-500'
    case 'contradicted':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

/** Prompt appendix label for non-canon tentative rows. */
export const BIBLE_TENTATIVE_PROMPT_LABEL = '[TENTATIVE — not approved canon]'
