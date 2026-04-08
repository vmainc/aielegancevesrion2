import { createError } from 'h3'
import type PocketBase from 'pocketbase'
import {
  downloadProjectAssetFileBuffer,
  parseScriptBufferToParsed
} from '~/server/utils/import-script-core'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'

export type ResolvedScriptWizardSource =
  | {
      kind: 'creative_script'
      id: string
      title: string
      scriptText: string
      existingTreatment: string
      row: Record<string, unknown>
    }
  | {
      kind: 'project_asset'
      id: string
      title: string
      scriptText: string
      existingTreatment: string
      row: Record<string, unknown>
    }

function parsedScenesToFullText (parsed: { scenes: Array<{ heading: string; body: string }> }): string {
  return parsed.scenes.map(s => `${s.heading}\n\n${s.body}`).join('\n\n---\n\n')
}

function parseAssetMetadata (raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) }
  }
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Script Wizard lists rows from `creative_scripts` or, in fallback mode, `project_assets` (kind script).
 * Treatment / breakdown handlers must accept either id type.
 */
export async function resolveScriptWizardSource (
  pb: PocketBase,
  userId: string,
  id: string
): Promise<ResolvedScriptWizardSource> {
  try {
    const row = await pb.collection('creative_scripts').getOne(id) as Record<string, unknown>
    const owner = pbRecordOwnerId(row)
    if (owner !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    const title = String(row.title || 'Untitled script').slice(0, 500)
    const scriptText = String(row.script_text || '')
    const existingTreatment = String(row.treatment || '')
    return {
      kind: 'creative_script',
      id,
      title,
      scriptText,
      existingTreatment,
      row
    }
  } catch (e: unknown) {
    const st = pocketBaseErrorStatus(e)
    if (st === 403) throw e
    if (st !== 404 && st !== 0) {
      const msg = e instanceof Error ? e.message : String(e)
      throw createError({ statusCode: st || 500, message: msg })
    }

    let asset: Record<string, unknown>
    try {
      asset = await pb.collection('project_assets').getOne(id) as Record<string, unknown>
    } catch (e2: unknown) {
      const msg = e2 instanceof Error ? e2.message : String(e2)
      throw createError({
        statusCode: 404,
        message: /wasn'?t found|not found/i.test(msg) ? 'Script not found' : msg
      })
    }

    const owner = pbRecordOwnerId(asset)
    if (owner !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    if (String(asset.kind || '') !== 'script') {
      throw createError({ statusCode: 400, message: 'Not a script asset' })
    }

    const meta = parseAssetMetadata(asset.metadata)
    const filename =
      String(meta.original_filename || meta.source_filename || '').trim() ||
      String(asset.title || 'script.upload').trim() ||
      'script.upload'

    const fileBuf = await downloadProjectAssetFileBuffer(pb, asset)
    let scriptText = ''
    try {
      const parsed = await parseScriptBufferToParsed(fileBuf, filename)
      scriptText = parsedScenesToFullText(parsed)
    } catch {
      const text = fileBuf.toString('utf8').trim()
      scriptText = text.slice(0, 300_000)
    }

    const title =
      String(meta.script_title || asset.title || 'Untitled script').slice(0, 500)

    return {
      kind: 'project_asset',
      id,
      title,
      scriptText,
      existingTreatment: String(meta.treatment || ''),
      row: asset
    }
  }
}

export async function updateCreativeScriptTreatmentFields (
  pb: PocketBase,
  id: string,
  patch: {
    synopsis: string
    treatment: string
    genre: string
    tone: string
    themes: string[]
    comparable_titles: Array<{ title: string; year?: string }>
  }
): Promise<Record<string, unknown>> {
  return (await pb.collection('creative_scripts').update(id, {
    synopsis: patch.synopsis.slice(0, 20_000),
    treatment: patch.treatment.slice(0, 50_000),
    genre: patch.genre.slice(0, 200),
    tone: patch.tone.slice(0, 500),
    themes: patch.themes.slice(0, 20),
    comparable_titles: patch.comparable_titles
  })) as Record<string, unknown>
}

export async function updateProjectAssetScriptWizardMetadata (
  pb: PocketBase,
  id: string,
  patch: {
    synopsis?: string
    treatment?: string
    genre?: string
    tone?: string
    themes?: string[]
    comparable_titles?: Array<{ title: string; year?: string }>
  }
): Promise<Record<string, unknown>> {
  const row = await pb.collection('project_assets').getOne(id) as Record<string, unknown>
  const meta = parseAssetMetadata(row.metadata)
  if (patch.synopsis !== undefined) meta.synopsis = patch.synopsis.slice(0, 20_000)
  if (patch.treatment !== undefined) meta.treatment = patch.treatment.slice(0, 50_000)
  if (patch.genre !== undefined) meta.genre = patch.genre.slice(0, 200)
  if (patch.tone !== undefined) meta.tone = patch.tone.slice(0, 500)
  if (patch.themes !== undefined) meta.themes = patch.themes.slice(0, 20)
  if (patch.comparable_titles !== undefined) meta.comparable_titles = patch.comparable_titles
  return (await pb.collection('project_assets').update(id, {
    metadata: JSON.stringify(meta)
  })) as Record<string, unknown>
}

export async function updateCreativeScriptTreatmentOnly (
  pb: PocketBase,
  id: string,
  treatment: string
): Promise<Record<string, unknown>> {
  return (await pb.collection('creative_scripts').update(id, {
    treatment: treatment.slice(0, 50_000)
  })) as Record<string, unknown>
}

export async function mergeProjectAssetTreatment (
  pb: PocketBase,
  id: string,
  treatment: string
): Promise<Record<string, unknown>> {
  return updateProjectAssetScriptWizardMetadata(pb, id, { treatment })
}
