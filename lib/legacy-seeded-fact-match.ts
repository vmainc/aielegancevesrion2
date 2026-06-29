import { CONTINUITY_BIBLE_FACT_TYPE, CONTINUITY_BIBLE_SOURCE_TYPE } from '~/lib/continuity-bible-fact'
import { BIBLE_SEED_SOURCE_TYPE } from '~/lib/bible-seed-normalize'

export const LEGACY_SEED_REMEDIATION_TARGET_STATUS = 'needs_review' as const

export type LegacySeededFactMatchInput = {
  projectId: string
  ownerId: string
  sourceType: string
  status: string
  actorType: string
  actorId: string
  factType: string
}

/** True for pre-PASS-13 auto-seeded facts that are still active and should be reviewed. */
export function isLegacySeededFactCandidate (
  fact: LegacySeededFactMatchInput,
  projectOwnerId: string
): boolean {
  if (!projectOwnerId || fact.ownerId !== projectOwnerId) return false
  if (fact.sourceType !== BIBLE_SEED_SOURCE_TYPE) return false
  if (fact.status !== 'active') return false

  if (fact.factType === CONTINUITY_BIBLE_FACT_TYPE) return false
  if (fact.sourceType === CONTINUITY_BIBLE_SOURCE_TYPE) return false

  const actorType = fact.actorType?.trim() || ''
  if (actorType === 'user' || actorType === 'ai') return false
  if (actorType && actorType !== 'system') return false

  if (fact.actorId?.trim() === projectOwnerId) return false

  return true
}
