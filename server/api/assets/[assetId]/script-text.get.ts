import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  downloadProjectAssetFileBuffer,
  parseScriptBufferToParsed
} from '~/server/utils/import-script-core'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'

function parseMetadata (raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown
      return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return {}
}

export default defineEventHandler(async (event) => {
  const assetId = getRouterParam(event, 'assetId')
  if (!assetId) {
    throw createError({ statusCode: 400, message: 'Missing asset id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  let asset: Record<string, unknown>
  try {
    asset = await pb.collection('project_assets').getOne(assetId) as Record<string, unknown>
  } catch (e: unknown) {
    const st = pocketBaseErrorStatus(e)
    throw createError({ statusCode: st === 404 ? 404 : 500, message: 'Script not found' })
  }

  const owner = pbRecordOwnerId(asset)
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  if (String(asset.kind || '') !== 'script') {
    throw createError({ statusCode: 400, message: 'Not a script asset' })
  }

  const meta = parseMetadata(asset.metadata)
  const title = String(asset.title || meta.script_title || 'Script').slice(0, 500)
  const creativeScriptId =
    typeof meta.creative_script_id === 'string' ? meta.creative_script_id.trim() : ''

  if (creativeScriptId) {
    try {
      const row = await pb.collection('creative_scripts').getOne(creativeScriptId) as Record<string, unknown>
      const scriptOwner = pbRecordOwnerId(row)
      if (scriptOwner !== userId) {
        throw createError({ statusCode: 403, message: 'Forbidden' })
      }
      const text = String(row.script_text || '').trim()
      if (text) {
        return { title, text: text.slice(0, 300_000) }
      }
    } catch (e: unknown) {
      const st = pocketBaseErrorStatus(e)
      if (st === 403) throw e
    }
  }

  const filename =
    String(meta.source_filename || meta.original_filename || '').trim() ||
    String(asset.title || 'script.txt')

  try {
    const fileBuf = await downloadProjectAssetFileBuffer(pb, asset)
    if (fileBuf?.length) {
      try {
        const parsed = await parseScriptBufferToParsed(fileBuf, filename)
        const text = parsed.scenes.map(s => `${s.heading}\n\n${s.body}`).join('\n\n---\n\n').trim()
        if (text) {
          return { title, text: text.slice(0, 300_000) }
        }
      } catch {
        const plain = fileBuf.toString('utf8').trim()
        if (plain) {
          return { title, text: plain.slice(0, 300_000) }
        }
      }
    }
  } catch {
    // fall through
  }

  const synopsis = typeof meta.synopsis === 'string' ? meta.synopsis.trim() : ''
  if (synopsis) {
    return { title, text: synopsis.slice(0, 300_000), partial: true }
  }

  throw createError({
    statusCode: 404,
    message: 'No readable script text for this entry. Try downloading the file instead.'
  })
})
