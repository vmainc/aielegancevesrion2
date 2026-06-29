import type PocketBase from 'pocketbase'
import type { ContinuityCheckStatus } from '~/lib/continuity-check-result'
import {
  CONTINUITY_BIBLE_ACTOR_TYPE,
  CONTINUITY_BIBLE_FACT_TYPE,
  CONTINUITY_BIBLE_SOURCE_TYPE,
  continuityBibleFactDedupeKey,
  continuityFactStatusForIssue,
  normalizeContinuityIssueStatement,
  resolveContinuityFactEntityId
} from '~/lib/continuity-bible-fact'
import { pbRecordToBibleEntity } from '~/server/utils/bible-entity-map'
import { pbRecordToBibleFact } from '~/server/utils/bible-fact-map'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

export interface PersistContinuityBibleFactsResult {
  created: number
  skippedDuplicate: number
  skippedInvalid: number
  failed: boolean
}

/**
 * Write continuity check issues into bible_facts as reviewable continuity rows.
 * Fail-open: never throws; never updates or overwrites existing facts.
 */
export async function persistContinuityFindingsToBible (opts: {
  pb: PocketBase
  userId: string
  projectId: string
  sceneId?: string
  shotId?: string
  checkStatus: ContinuityCheckStatus
  issues: string[]
  characters: Array<{ id: string; name: string }>
}): Promise<PersistContinuityBibleFactsResult> {
  const result: PersistContinuityBibleFactsResult = {
    created: 0,
    skippedDuplicate: 0,
    skippedInvalid: 0,
    failed: false
  }

  if (opts.checkStatus !== 'ran' || !opts.issues.length) return result

  const sourceId = (opts.shotId || opts.sceneId || '').trim()

  let entityRows: unknown[] = []
  let factRows: unknown[] = []
  try {
    entityRows = await opts.pb.collection('bible_entities').getFullList({
      filter: `project="${opts.projectId}"`,
      batch: 200
    })
    factRows = await opts.pb.collection('bible_facts').getFullList({
      filter: `project="${opts.projectId}"`,
      batch: 400
    })
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) return result
    result.failed = true
    return result
  }

  const bibleEntities = entityRows.map((r) =>
    pbRecordToBibleEntity(r as Parameters<typeof pbRecordToBibleEntity>[0])
  )

  const existingKeys = new Set<string>()
  for (const row of factRows) {
    const fact = pbRecordToBibleFact(row as Parameters<typeof pbRecordToBibleFact>[0])
    if (fact.factType !== CONTINUITY_BIBLE_FACT_TYPE) continue
    existingKeys.add(
      continuityBibleFactDedupeKey(CONTINUITY_BIBLE_FACT_TYPE, fact.statement, fact.sourceId)
    )
  }

  for (const rawIssue of opts.issues) {
    const statement = normalizeContinuityIssueStatement(rawIssue)
    if (!statement) {
      result.skippedInvalid++
      continue
    }

    const dedupeKey = continuityBibleFactDedupeKey(
      CONTINUITY_BIBLE_FACT_TYPE,
      statement,
      sourceId
    )
    if (existingKeys.has(dedupeKey)) {
      result.skippedDuplicate++
      continue
    }

    const entityId = resolveContinuityFactEntityId(statement, opts.characters, bibleEntities)
    const status = continuityFactStatusForIssue(statement)

    const payload: Record<string, unknown> = {
      owned_by: opts.userId,
      project: opts.projectId,
      fact_type: CONTINUITY_BIBLE_FACT_TYPE,
      statement,
      status,
      source_type: CONTINUITY_BIBLE_SOURCE_TYPE,
      source_id: sourceId,
      actor_type: CONTINUITY_BIBLE_ACTOR_TYPE,
      confidence: 0.5
    }

    if (entityId) {
      payload.entity = entityId
    }

    if (opts.shotId) {
      payload.scope_type = 'shot'
      payload.scope_id = opts.shotId
    } else if (opts.sceneId) {
      payload.scope_type = 'scene'
      payload.scope_id = opts.sceneId
    } else {
      payload.scope_type = 'project'
      payload.scope_id = opts.projectId
    }

    try {
      await opts.pb.collection('bible_facts').create(payload)
      existingKeys.add(dedupeKey)
      result.created++
    } catch (createErr: unknown) {
      console.warn(
        '[persist-continuity-bible-facts] create failed:',
        createErr instanceof Error ? createErr.message : createErr
      )
      result.failed = true
    }
  }

  return result
}
