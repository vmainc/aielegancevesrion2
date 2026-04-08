import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  downloadProjectAssetFileBuffer,
  parseScriptBufferToParsed
} from '~/server/utils/import-script-core'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import {
  filterLikelyCharacterNames,
  heuristicCharacterNamesFromScenes
} from '~/server/utils/parse-script-txt'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError
} from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

function isScriptImportWorkflowRow (row: { notes?: string; metadata?: unknown }): boolean {
  const notes = String(row.notes || '')
  const meta = row.metadata
  let source = ''
  if (meta && typeof meta === 'object' && meta !== null && 'source' in meta) {
    source = String((meta as { source?: string }).source || '')
  }
  return source === 'script_import' || notes.includes('Imported script for') || notes.includes('Screenplay file saved')
}

function filenameFromAsset (row: Record<string, unknown>): string {
  const meta = row.metadata
  if (meta && typeof meta === 'object' && meta !== null && 'original_filename' in meta) {
    const n = String((meta as { original_filename?: string }).original_filename || '').trim()
    if (n) return n
  }
  if (typeof meta === 'string') {
    try {
      const o = JSON.parse(meta) as { original_filename?: string }
      const n = String(o.original_filename || '').trim()
      if (n) return n
    } catch {
      /* ignore */
    }
  }
  return String(row.title || 'script.upload').trim() || 'script.upload'
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  try {
    const projectRow = await pb.collection('creative_projects').getOne(projectId)
    const owner = pbRecordOwnerId(projectRow as { owner?: unknown; user?: unknown })
    if (owner !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }

    let list: unknown[]
    try {
      list = await listProjectAssetsForProject(pb, projectId, userId, { kind: 'script' })
    } catch (e: unknown) {
      if (isPocketBaseMissingCollectionError(e)) {
        throw createError({
          statusCode: 503,
          message:
            'project_assets collection is missing. Run setup-db against production PocketBase and retry.'
        })
      }
      const msg = e instanceof Error ? e.message : String(e)
      throw createError({ statusCode: 500, message: msg || 'Could not list screenplay assets' })
    }

    const asset = list.find(r => isScriptImportWorkflowRow(r as { notes?: string; metadata?: unknown }))
    if (!asset) {
      return {
        names: [] as string[],
        sourceFilename: null as string | null,
        message: 'No screenplay file saved for this project. Upload a script on Overview first.'
      }
    }

    const row = asset as Record<string, unknown>
    const filename = filenameFromAsset(row)

    let fileBuf: Buffer
    try {
      fileBuf = await downloadProjectAssetFileBuffer(pb, row)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return {
        names: [] as string[],
        sourceFilename: filename,
        sceneCount: 0,
        parseWarning:
          msg ||
          'Could not read the screenplay file from storage. Try re-uploading the script on Overview.'
      }
    }

    try {
      const parsed = await parseScriptBufferToParsed(fileBuf, filename)
      const merged = filterLikelyCharacterNames([
        ...parsed.characterNames.map(n => n.trim()).filter(Boolean),
        ...heuristicCharacterNamesFromScenes(parsed.scenes)
      ]).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      return {
        names: merged,
        sourceFilename: filename,
        sceneCount: parsed.scenes.length
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'statusCode' in e && Number((e as { statusCode?: number }).statusCode) === 400
          ? String((e as { message?: string }).message || '')
          : e instanceof Error
            ? e.message
            : String(e)
      return {
        names: [] as string[],
        sourceFilename: filename,
        sceneCount: 0,
        parseWarning:
          msg ||
          'Could not parse this file for character cues (e.g. some PDFs). You can still run director analysis — the server uses a separate parse path.'
      }
    }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message:
          'PocketBase schema is incomplete for script features. Run setup-db against production PocketBase and retry.'
      })
    }
    const msg = formatPocketBaseRecordError(e)
    const status =
      e && typeof e === 'object' && 'statusCode' in e
        ? Number((e as { statusCode?: number }).statusCode || 500)
        : e && typeof e === 'object' && 'status' in e
          ? Number((e as { status?: number }).status || 500)
          : 500
    throw createError({
      statusCode: status >= 400 && status < 600 ? status : 500,
      message: msg || 'Could not read speaking characters for this project.'
    })
  }
})
