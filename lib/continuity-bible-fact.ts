import { castNameAppearsInText } from '~/lib/cast-name-convention'
import {
  bibleEntityDedupeKey,
  BIBLE_SEED_CHARACTER_SOURCE,
  normalizeBibleFactStatementKey
} from '~/lib/bible-seed-normalize'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleFactStatus } from '~/types/bible-fact'

export const CONTINUITY_BIBLE_FACT_TYPE = 'continuity'
export const CONTINUITY_BIBLE_SOURCE_TYPE = 'continuity_check'
export const CONTINUITY_BIBLE_ACTOR_TYPE = 'system'

/** Dedupe key: project + fact_type + normalized statement + source_id (caller scopes by project). */
export function continuityBibleFactDedupeKey (
  factType: string,
  statement: string,
  sourceId: string
): string {
  return [
    factType.trim().toLowerCase(),
    normalizeBibleFactStatementKey(statement),
    sourceId.trim()
  ].join('|')
}

export function normalizeContinuityIssueStatement (issue: string): string {
  const trimmed = issue.trim().replace(/^[-•*]\s*/, '')
  if (!trimmed) return ''
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return capped.length > 500 ? `${capped.slice(0, 497)}...` : capped
}

export function continuityFactStatusForIssue (issue: string): Extract<BibleFactStatus, 'draft' | 'needs_review'> {
  const lower = issue.toLowerCase()
  if (/contradict|inconsisten|conflict|mismatch|discrepanc|violat|warn/.test(lower)) {
    return 'needs_review'
  }
  return 'draft'
}

/**
 * Attach to a Bible entity only when exactly one cast member name appears in the issue text
 * and a matching bible entity exists.
 */
export function resolveContinuityFactEntityId (
  statement: string,
  characters: Array<{ id: string; name: string }>,
  bibleEntities: BibleEntity[]
): string | null {
  const matches = characters.filter(
    (c) => c.name.trim() && castNameAppearsInText(c.name, statement)
  )
  if (matches.length !== 1) return null

  const char = matches[0]!
  const bySource = bibleEntities.find(
    (e) => e.sourceType === BIBLE_SEED_CHARACTER_SOURCE && e.sourceId === char.id
  )
  if (bySource) return bySource.id

  const key = bibleEntityDedupeKey('character', char.name)
  const byName = bibleEntities.find((e) => bibleEntityDedupeKey(e.type, e.name) === key)
  return byName?.id ?? null
}
