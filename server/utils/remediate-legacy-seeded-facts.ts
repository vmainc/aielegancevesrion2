import type PocketBase from 'pocketbase'
import {
  isLegacySeededFactCandidate,
  LEGACY_SEED_REMEDIATION_TARGET_STATUS
} from '~/lib/legacy-seeded-fact-match'
import { pbRecordToBibleFact, projectIdOnBibleFactRow } from '~/server/utils/bible-fact-map'
import type { BibleSeedRemediationResult, BibleSeedRemediationSample } from '~/types/bible-seed-remediation-result'

const SAMPLE_LIMIT = 20

function toSample (fact: ReturnType<typeof pbRecordToBibleFact>): BibleSeedRemediationSample {
  return {
    id: fact.id,
    statement: fact.statement.slice(0, 200),
    factType: fact.factType,
    entityId: fact.entityId,
    currentStatus: fact.status,
    targetStatus: LEGACY_SEED_REMEDIATION_TARGET_STATUS
  }
}

async function loadProjectFacts (
  pb: PocketBase,
  projectId: string
): Promise<ReturnType<typeof pbRecordToBibleFact>[]> {
  try {
    const rows = await pb.collection('bible_facts').getFullList({
      filter: `project="${projectId}"`,
      batch: 2000
    })
    return rows.map((r) => pbRecordToBibleFact(r as Parameters<typeof pbRecordToBibleFact>[0]))
  } catch {
    try {
      const all = await pb.collection('bible_facts').getFullList({ batch: 2000 })
      return all
        .filter((r) => projectIdOnBibleFactRow(r as Record<string, unknown>) === projectId)
        .map((r) => pbRecordToBibleFact(r as Parameters<typeof pbRecordToBibleFact>[0]))
    } catch {
      return []
    }
  }
}

/**
 * Find and optionally downgrade legacy pre-PASS-13 seeded facts (active → needs_review).
 * Never runs automatically; caller must opt in via API.
 */
export async function remediateLegacySeededFacts (opts: {
  pb: PocketBase
  userId: string
  projectId: string
  dryRun?: boolean
}): Promise<BibleSeedRemediationResult> {
  const { pb, userId, projectId, dryRun = false } = opts

  const facts = await loadProjectFacts(pb, projectId)
  const candidates = facts.filter((f) =>
    f.projectId === projectId && isLegacySeededFactCandidate(f, userId)
  )

  const result: BibleSeedRemediationResult = {
    dryRun,
    foundCount: candidates.length,
    updatedCount: 0,
    skippedCount: 0,
    targetStatus: LEGACY_SEED_REMEDIATION_TARGET_STATUS,
    samples: candidates.slice(0, SAMPLE_LIMIT).map(toSample)
  }

  if (dryRun || !candidates.length) return result

  for (const fact of candidates) {
    if (!isLegacySeededFactCandidate(fact, userId)) {
      result.skippedCount++
      continue
    }
    try {
      await pb.collection('bible_facts').update(fact.id, {
        status: LEGACY_SEED_REMEDIATION_TARGET_STATUS
      })
      result.updatedCount++
    } catch {
      result.skippedCount++
    }
  }

  return result
}
