/** @deprecated Import from `~/lib/bible-trust` — re-exports for PASS 12 callers. */
export {
  BIBLE_FACT_PENDING_REVIEW_STATUSES,
  BIBLE_FACT_TRUSTED_CONTEXT_STATUSES,
  defaultUserAuthoredFactStatus,
  isAiOriginatedBibleFact,
  isBibleFactPendingReview,
  isBibleFactTrustedForContext,
  bibleStatusBadgeClass as bibleFactStatusBadgeClass,
  bibleStatusDisplayLabel as bibleFactStatusDisplayLabel
} from '~/lib/bible-trust'

export type { BibleFactPendingReviewStatus } from '~/lib/bible-trust'
