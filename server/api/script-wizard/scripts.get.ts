import { createError } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeScript } from '~/server/utils/creative-script-map'
import type { CreativeScript } from '~/types/creative-script'

function isMissingCollectionError (e: unknown): boolean {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message || '') : String(e)
  const status = e && typeof e === 'object' && 'status' in e ? Number((e as { status?: number }).status || 0) : 0
  return status === 404 || /missing collection context|wasn't found|not found|missing collection/i.test(msg)
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
    if (isMissingCollectionError(e)) {
      const assets = await pb.collection('project_assets').getFullList({
        filter: `owned_by = "${userId}" && kind = "script"`,
        sort: '-updated',
        batch: 200
      })
      const items: CreativeScript[] = assets.map((a) => {
        const raw = a as Record<string, unknown>
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
      })
      return { items, warning: 'creative_scripts collection missing; using script asset fallback' }
    }
    throw createError({ statusCode: 500, message: msg })
  }
})

