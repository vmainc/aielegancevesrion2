import { createError, getQuery } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import { projectIdOnCharacterRow } from '~/server/utils/creative-character-map'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import type { ProjectAsset } from '~/types/project-asset'

const PB_ID = /^[a-z0-9]{15}$/

function normalizeCharacterNameKey (name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function mergeCharacterHubItems (projectAssets: ProjectAsset[], characterRowAssets: ProjectAsset[]): ProjectAsset[] {
  const coveredIds = new Set<string>()
  const coveredNames = new Set<string>()

  for (const a of projectAssets) {
    if (a.kind !== 'character') continue
    if (!a.projectId || !PB_ID.test(a.projectId)) continue

    const meta = a.metadata && typeof a.metadata === 'object' ? (a.metadata as Record<string, unknown>) : null
    const cid = typeof meta?.character_id === 'string' ? meta.character_id.trim() : ''
    if (cid && PB_ID.test(cid)) {
      coveredIds.add(`${a.projectId}:${cid}`)
    }

    // If we already have an image asset for this cast member, don't also show the synthetic "character row" card.
    if (a.fileUrl) {
      const cname = typeof meta?.character_name === 'string' ? normalizeCharacterNameKey(meta.character_name) : ''
      if (cname) coveredNames.add(`${a.projectId}:${cname}`)
      const titleName = normalizeCharacterNameKey(String(a.title || '').split('—')[0] || '')
      if (titleName) coveredNames.add(`${a.projectId}:${titleName}`)
    }
  }

  const filteredRows = characterRowAssets.filter((row) => {
    const meta = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : null
    const cid = typeof meta?.character_id === 'string' ? meta.character_id.trim() : ''
    if (cid && PB_ID.test(cid) && row.projectId && PB_ID.test(row.projectId)) {
      if (coveredIds.has(`${row.projectId}:${cid}`)) return false
    }
    const nm = normalizeCharacterNameKey(row.title || '')
    if (nm && row.projectId && PB_ID.test(row.projectId)) {
      if (coveredNames.has(`${row.projectId}:${nm}`)) return false
    }
    return true
  })

  return [...projectAssets, ...filteredRows].sort((a, b) =>
    String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || ''))
  )
}

async function listProjectAssetsRecordsForHub (
  pb: Awaited<ReturnType<typeof getAuthenticatedPocketBase>>,
  userId: string,
  kind: string
): Promise<{ records: Array<Record<string, unknown>>; allListAttemptsWere400: boolean }> {
  const reqKey = `assets_my_fallback_${userId}_${kind}`
  const tries = [
    () =>
      pb.collection('project_assets').getFullList({
        sort: '-created',
        batch: 500,
        expand: 'project',
        requestKey: reqKey
      }),
    () =>
      pb.collection('project_assets').getFullList({
        sort: '-updated',
        batch: 500,
        expand: 'project',
        requestKey: reqKey
      }),
    () => pb.collection('project_assets').getFullList({ batch: 200, expand: 'project', requestKey: reqKey }),
    () => pb.collection('project_assets').getFullList({ expand: 'project', requestKey: reqKey }),
    () => pb.collection('project_assets').getFullList({ sort: '-created', batch: 500, requestKey: reqKey }),
    () => pb.collection('project_assets').getFullList({ requestKey: reqKey })
  ]
  let lastNon400: unknown
  for (const run of tries) {
    try {
      const rows = await run()
      return { records: rows as Array<Record<string, unknown>>, allListAttemptsWere400: false }
    } catch (e) {
      if (pocketBaseErrorStatus(e) === 400) continue
      lastNon400 = e
      break
    }
  }
  if (lastNon400) throw lastNon400
  return { records: [], allListAttemptsWere400: true }
}

async function listCreativeCharacterRecordsForHub (
  pb: Awaited<ReturnType<typeof getAuthenticatedPocketBase>>,
  userId: string
): Promise<Array<Record<string, unknown>>> {
  const requestKey = `assets_my_characters_${userId}`
  const tries = [
    () =>
      pb.collection('creative_characters').getFullList({
        filter: `owned_by = "${userId}"`,
        sort: '-updated',
        expand: 'project',
        batch: 500,
        requestKey
      }),
    () =>
      pb.collection('creative_characters').getFullList({
        filter: `owned_by="${userId}"`,
        sort: '-updated',
        expand: 'project',
        batch: 500,
        requestKey
      }),
    () =>
      pb.collection('creative_characters').getFullList({
        sort: '-updated',
        expand: 'project',
        batch: 500,
        requestKey
      }),
    () =>
      pb.collection('creative_characters').getFullList({
        expand: 'project',
        requestKey
      })
  ]
  let lastNon400: unknown
  for (const run of tries) {
    try {
      const rows = await run()
      const asRows = rows as Array<Record<string, unknown>>
      // If query had to run without owner filter, enforce owner filtering in-memory.
      const filtered = asRows.filter((r) => {
        if (pbRecordOwnerId(r) === userId) return true
        const exp = r.expand as { project?: Record<string, unknown> } | undefined
        if (exp?.project && pbRecordOwnerId(exp.project) === userId) return true
        return false
      })
      return filtered
    } catch (e) {
      if (isPocketBaseMissingCollectionError(e)) return []
      if (pocketBaseErrorStatus(e) === 400) continue
      lastNon400 = e
      break
    }
  }
  if (lastNon400) throw lastNon400
  return []
}

/**
 * All assets for the signed-in user (across projects), for /assets hub.
 */
export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()
  const q = getQuery(event)
  const kind = typeof q.kind === 'string' ? q.kind.trim() : ''

  let filter = `owned_by = "${userId}"`
  if (kind && ['script', 'character', 'storyboard', 'video', 'other'].includes(kind)) {
    filter += ` && kind = "${kind}"`
  }

  const mapProjectAssets = (rows: Array<Record<string, unknown>>) =>
    rows.map((r) => {
      const mapped = pbRecordToProjectAsset(r, pb)
      const exp = (r as { expand?: { project?: { name?: string } } }).expand
      if (exp?.project?.name) {
        mapped.projectName = exp.project.name
      }
      return mapped
    })

  const mapCharacterRowsAsAssets = (rows: Array<Record<string, unknown>>) =>
    rows.map((r) => {
      const id = String(r.id || '')
      const name = String(r.name || '').trim() || 'Untitled character'
      const roleDescription = String(r.role_description || '').trim()
      const projectId = projectIdOnCharacterRow(r)
      const exp = r.expand as { project?: { name?: string } } | undefined
      const created = String(r.created || r.updated || '')
      const updated = String(r.updated || r.created || '')
      return {
        id: `charrow_${id}`,
        projectId,
        projectName: exp?.project?.name || '',
        kind: 'character' as const,
        title: name,
        notes: roleDescription,
        metadata: { source: 'creative_character_row', character_id: id },
        sortOrder: 0,
        fileUrl: null,
        created,
        updated
      }
    })

  try {
    const rows = await pb.collection('project_assets').getFullList({
      filter,
      sort: '-created',
      expand: 'project',
      requestKey: `assets_my_${userId}_${kind}`
    })
    const projectAssets = mapProjectAssets(rows as Array<Record<string, unknown>>)
    if (kind !== 'character') return { items: projectAssets }

    const characterRows = await listCreativeCharacterRecordsForHub(pb, userId)
    const characterAssets = mapCharacterRowsAsAssets(characterRows)

    return {
      items: mergeCharacterHubItems(projectAssets, characterAssets)
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e)
    const status = pocketBaseErrorStatus(e)
    if (isPocketBaseMissingCollectionError(e)) {
      // Graceful fallback so Assets pages remain usable while PB schema is being provisioned.
      return { items: [], warning: 'project_assets collection missing' }
    }
    if (status === 400) {
      try {
        const { records: all, allListAttemptsWere400 } = await listProjectAssetsRecordsForHub(pb, userId, kind)
        if (allListAttemptsWere400) {
          return {
            items: [],
            warning:
              'Could not read project_assets from PocketBase (400 on every list attempt). Run: node scripts/setup-collections.js against http://127.0.0.1:8090'
          }
        }
        let rows = all.filter(r => pbRecordOwnerId(r) === userId)
        if (kind && ['script', 'character', 'storyboard', 'video', 'other'].includes(kind)) {
          rows = rows.filter(r => String(r.kind || '') === kind)
        }
        const projectAssets = mapProjectAssets(rows)
        if (kind !== 'character') {
          return {
            items: projectAssets,
            warning:
              'project_assets filter query failed (400); listed your assets using an in-memory filter. Run node scripts/add-fields-to-collections.js if the schema is out of date.'
          }
        }

        const characterRows = await listCreativeCharacterRecordsForHub(pb, userId)
        const characterAssets = mapCharacterRowsAsAssets(characterRows)

        return {
          items: mergeCharacterHubItems(projectAssets, characterAssets),
          warning:
            'project_assets filter query failed (400); listed your assets using an in-memory filter. Run node scripts/add-fields-to-collections.js if the schema is out of date.'
        }
      } catch (e2: unknown) {
        throw createError({ statusCode: pocketBaseErrorStatus(e2) || 500, message: e2 instanceof Error ? e2.message : String(e2) })
      }
    }
    throw createError({ statusCode: status || 500, message: msg })
  }
})
