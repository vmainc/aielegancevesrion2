import { createError } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pbRecordToCreativeScript } from '~/server/utils/creative-script-map'
import type { CreativeScript } from '~/types/creative-script'


/** Some PocketBase installs return 400 for list queries (bad sort field, schema drift). Try simpler queries, then give up. */
async function listProjectAssetsRecords (
  pb: Awaited<ReturnType<typeof getAuthenticatedPocketBase>>
): Promise<{ records: Array<Record<string, unknown>>; allListAttemptsWere400: boolean }> {
  const tries = [
    () => pb.collection('project_assets').getFullList({ sort: '-updated', batch: 300 }),
    () => pb.collection('project_assets').getFullList({ sort: '-created', batch: 300 }),
    () => pb.collection('project_assets').getFullList({ batch: 200 }),
    () => pb.collection('project_assets').getFullList()
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

async function listCreativeScriptsRecords (
  pb: Awaited<ReturnType<typeof getAuthenticatedPocketBase>>
): Promise<{ records: Array<Record<string, unknown>>; allListAttemptsWere400: boolean }> {
  const tries = [
    () => pb.collection('creative_scripts').getFullList({ sort: '-updated', batch: 300 }),
    () => pb.collection('creative_scripts').getFullList({ sort: '-created', batch: 300 }),
    () => pb.collection('creative_scripts').getFullList({ batch: 200 }),
    () => pb.collection('creative_scripts').getFullList()
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

function mapAssetToCreativeScript (raw: Record<string, unknown>): CreativeScript {
  const meta = raw.metadata && typeof raw.metadata === 'object'
    ? (raw.metadata as Record<string, unknown>)
    : {}
  const themes = Array.isArray(meta.themes)
    ? meta.themes.map(t => String(t || '')).filter(Boolean)
    : []
  const comparableTitles = Array.isArray(meta.comparable_titles)
    ? meta.comparable_titles
        .filter(x => x && typeof x === 'object')
        .map((x) => {
          const o = x as Record<string, unknown>
          return { title: String(o.title || ''), year: String(o.year || '') || undefined }
        })
        .filter(x => x.title)
    : []
  return {
    id: String(raw.id),
    title: String(raw.title || meta.script_title || 'Script'),
    status: String(meta.status || 'in_progress') as CreativeScript['status'],
    sourceFilename: String(meta.source_filename || ''),
    scriptText: '',
    synopsis: String(meta.synopsis || ''),
    treatment: String(meta.treatment || ''),
    genre: String(meta.genre || ''),
    tone: String(meta.tone || ''),
    themes,
    comparableTitles,
    created: String(raw.created || ''),
    updated: String(raw.updated || '')
  }
}

async function listScriptsFromProjectAssets (
  pb: Awaited<ReturnType<typeof getAuthenticatedPocketBase>>,
  userId: string
) {
  try {
    const assets = await pb.collection('project_assets').getFullList({
      filter: `owned_by = "${userId}" && kind = "script"`,
      sort: '-updated',
      batch: 200
    })
    return {
      items: assets.map(a => mapAssetToCreativeScript(a as Record<string, unknown>)),
      warning: 'creative_scripts collection missing; using script asset fallback'
    }
  } catch (assetErr: unknown) {
    if (isPocketBaseMissingCollectionError(assetErr)) {
      return {
        items: [] as CreativeScript[],
        warning: 'creative_scripts and project_assets collections are missing. Run: node scripts/setup-collections.js'
      }
    }
    if (pocketBaseErrorStatus(assetErr) === 400) {
      const { records: all, allListAttemptsWere400 } = await listProjectAssetsRecords(pb)
      if (allListAttemptsWere400) {
        return {
          items: [] as CreativeScript[],
          warning:
            'Could not read project_assets from PocketBase (400 on every list attempt). Run: node scripts/setup-collections.js (or node scripts/add-fields-to-collections.js) against http://127.0.0.1:8090'
        }
      }
      const items = all
        .filter((a) => {
          const r = a
          return r.kind === 'script' && pbRecordOwnerId(r) === userId
        })
        .map(a => mapAssetToCreativeScript(a))
      return {
        items,
        warning:
          'Script assets listed with in-memory filter (PocketBase rejected the filter query). Check project_assets schema.'
      }
    }
    throw assetErr
  }
}

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  try {
    const rows = await pb.collection('creative_scripts').getFullList({
      filter: `owned_by = "${userId}"`,
      sort: '-updated',
      batch: 200
    })
    const items: CreativeScript[] = rows.map(r =>
      pbRecordToCreativeScript(r as Record<string, unknown>)
    )
    return { items }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = pocketBaseErrorStatus(e)

    if (isPocketBaseMissingCollectionError(e)) {
      return listScriptsFromProjectAssets(pb, userId)
    }

    if (status === 400) {
      try {
        const { records: all, allListAttemptsWere400 } = await listCreativeScriptsRecords(pb)
        if (allListAttemptsWere400) {
          return listScriptsFromProjectAssets(pb, userId)
        }
        const rows = all.filter(r => pbRecordOwnerId(r) === userId)
        const items = rows.map(r => pbRecordToCreativeScript(r))
        return {
          items,
          warning:
            'creative_scripts filter query failed (400); listed your scripts using an in-memory filter. Run node scripts/add-fields-to-collections.js if the schema is out of date.'
        }
      } catch (e2: unknown) {
        if (isPocketBaseMissingCollectionError(e2)) {
          return listScriptsFromProjectAssets(pb, userId)
        }
        throw createError({ statusCode: pocketBaseErrorStatus(e2) || 500, message: e2 instanceof Error ? e2.message : String(e2) })
      }
    }

    throw createError({ statusCode: status || 500, message: msg })
  }
})

