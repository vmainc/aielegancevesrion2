import type { CastBibleMatchConfidence } from '~/lib/bible-cast-bridge'

export interface BibleCastLinkRow {
  characterId: string
  characterName: string
  entityId?: string
  entityName?: string
  confidence?: CastBibleMatchConfidence
  reason?: string
  candidateEntityIds?: string[]
}

export interface BibleCastLinkResult {
  dryRun: boolean
  matchedCount: number
  createdCount: number
  linkedCount: number
  skippedCount: number
  ambiguousCount: number
  matched: BibleCastLinkRow[]
  created: BibleCastLinkRow[]
  linked: BibleCastLinkRow[]
  skipped: BibleCastLinkRow[]
  ambiguous: BibleCastLinkRow[]
}
