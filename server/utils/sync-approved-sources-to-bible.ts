import {
  syncProjectToBible,
  syncProjectToBibleSafe,
  type ProjectBibleSyncResult,
  BIBLE_DIRECTOR_SOURCE,
  BIBLE_PROJECT_MIRROR_SOURCE as BIBLE_APPROVED_SOURCE_TYPE,
  BIBLE_PROJECT_SYNC_ACTOR_ID as BIBLE_APPROVED_SYNC_ACTOR_ID
} from '~/server/utils/sync-project-to-bible'

export {
  BIBLE_DIRECTOR_SOURCE,
  BIBLE_APPROVED_SOURCE_TYPE,
  BIBLE_APPROVED_SYNC_ACTOR_ID,
  syncProjectToBible,
  syncProjectToBibleSafe
}

export type ApprovedBibleSyncResult = {
  charactersSynced: number
  directorSynced: boolean
  entitiesCreated: number
  entitiesUpdated: number
  factsCreated: number
  factsPromoted: number
  skipped: boolean
  skipReason?: string
}

function toApproved (r: ProjectBibleSyncResult): ApprovedBibleSyncResult {
  return {
    charactersSynced: r.charactersSynced,
    directorSynced: r.directorSynced,
    entitiesCreated: r.entitiesCreated,
    entitiesUpdated: r.entitiesUpdated,
    factsCreated: r.factsCreated,
    factsPromoted: r.factsUpdated,
    skipped: r.skipped,
    skipReason: r.skipReason
  }
}

/** @deprecated Prefer syncProjectToBible — kept for existing call sites. */
export async function syncApprovedSourcesToBible (opts: {
  pb: import('pocketbase').default
  userId: string
  projectId: string
  characterIds?: string[] | 'all'
  director?: boolean
}): Promise<ApprovedBibleSyncResult> {
  const scopes: Array<'characters' | 'director'> = []
  if (opts.characterIds === 'all' || (Array.isArray(opts.characterIds) && opts.characterIds.length)) {
    scopes.push('characters')
  }
  if (opts.director) scopes.push('director')
  const r = await syncProjectToBible({
    pb: opts.pb,
    userId: opts.userId,
    projectId: opts.projectId,
    scopes: scopes.length ? scopes : [],
    characterIds:
      opts.characterIds === 'all' || !opts.characterIds ? undefined : opts.characterIds
  })
  return toApproved(r)
}

export async function syncApprovedSourcesToBibleSafe (
  opts: Parameters<typeof syncApprovedSourcesToBible>[0]
): Promise<ApprovedBibleSyncResult | null> {
  const scopes: Array<'characters' | 'director'> = []
  if (opts.characterIds === 'all' || (Array.isArray(opts.characterIds) && opts.characterIds.length)) {
    scopes.push('characters')
  }
  if (opts.director) scopes.push('director')
  if (!scopes.length) {
    return {
      charactersSynced: 0,
      directorSynced: false,
      entitiesCreated: 0,
      entitiesUpdated: 0,
      factsCreated: 0,
      factsPromoted: 0,
      skipped: true,
      skipReason: 'nothing requested'
    }
  }
  const r = await syncProjectToBibleSafe({
    pb: opts.pb,
    userId: opts.userId,
    projectId: opts.projectId,
    scopes,
    characterIds:
      opts.characterIds === 'all' || !opts.characterIds ? undefined : opts.characterIds
  })
  return r ? toApproved(r) : null
}
