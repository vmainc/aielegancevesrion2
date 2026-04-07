import { createError, getHeader, readMultipartFormData } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { parseFdxXml } from '~/server/utils/parse-script-fdx'
import { parsePlainScriptText } from '~/server/utils/parse-script-txt'
import { extractTextFromPdfBuffer } from '~/server/utils/extract-pdf-text'
import {
  enrichScriptWithAi,
  enrichmentToProjectFields,
  inferThreeActThemeBreakdown
} from '~/server/utils/script-import-ai'
import { extractComparableTitlesFromTreatment } from '~/server/utils/script-wizard-omdb'
import { pbRecordToCreativeScript } from '~/server/utils/creative-script-map'
import type { CreativeScriptStatus } from '~/types/creative-script'
import type { CreativeScript } from '~/types/creative-script'

const VALID_STATUS = new Set<CreativeScriptStatus>(['draft', 'in_progress', 'final'])
function isMissingCollectionError (e: unknown): boolean {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message || '') : String(e)
  const status = e && typeof e === 'object' && 'status' in e ? Number((e as { status?: number }).status || 0) : 0
  return status === 404 || /missing collection context|wasn't found|not found|missing collection/i.test(msg)
}

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const parts = await readMultipartFormData(event)
  if (parts == null || !parts.length) {
    const ct = getHeader(event, 'content-type') || ''
    throw createError({
      statusCode: 400,
      message: ct.includes('multipart')
        ? 'Could not read upload body. Ensure the file field is named "file".'
        : `Expected multipart/form-data upload (got: ${ct || 'no Content-Type'})`
    })
  }

  let fileBuf: Buffer | null = null
  let filename = 'script'
  let title = ''
  let status: CreativeScriptStatus = 'draft'
  for (const part of parts) {
    if (!part.name) continue
    if (part.name === 'file' && part.data?.length) {
      fileBuf = part.data
      filename = (part.filename && part.filename.trim()) || 'script.upload'
    }
    if (part.name === 'title' && part.data) {
      title = part.data.toString('utf8').trim()
    }
    if (part.name === 'status' && part.data) {
      const v = part.data.toString('utf8').trim()
      if (VALID_STATUS.has(v as CreativeScriptStatus)) status = v as CreativeScriptStatus
    }
  }
  if (!fileBuf?.length) {
    throw createError({ statusCode: 400, message: 'Missing script file' })
  }

  const lower = filename.toLowerCase()
  const isFdx = lower.endsWith('.fdx')
  const isTxt = lower.endsWith('.txt')
  const isPdf = lower.endsWith('.pdf')
  if (!isFdx && !isTxt && !isPdf) {
    throw createError({ statusCode: 400, message: 'Only .fdx, .txt, and .pdf files are supported' })
  }

  let parsed: ReturnType<typeof parseFdxXml> | ReturnType<typeof parsePlainScriptText>
  let sourceText = ''
  if (isPdf) {
    sourceText = await extractTextFromPdfBuffer(fileBuf)
    parsed = parsePlainScriptText(sourceText)
  } else {
    sourceText = fileBuf.toString('utf8')
    parsed = isFdx ? parseFdxXml(sourceText) : parsePlainScriptText(sourceText)
  }
  const fallbackBody = sourceText.trim().slice(0, 100000)
  const parsedScenes = parsed.scenes.length
    ? parsed.scenes
    : [{
        heading: 'Imported Draft',
        body: fallbackBody || 'Draft uploaded without screenplay scene markers.'
      }]

  const stemTitle = filename.replace(/\.(fdx|txt|pdf)$/i, '').replace(/[_-]+/g, ' ').trim()
  const scriptTitle = (title || stemTitle || 'Untitled script').slice(0, 500)
  const sceneOutline = parsedScenes
    .map((s, i) => `## Scene ${i}\nHeading: ${s.heading}\n---\n${s.body.slice(0, 2000)}`)
    .join('\n\n')
  const fullScriptText = parsedScenes.map(s => `${s.heading}\n\n${s.body}`).join('\n\n---\n\n')

  const enrichment = await enrichScriptWithAi({
    projectName: scriptTitle,
    sceneOutline,
    characterNames: parsed.characterNames
  })
  const prose = enrichmentToProjectFields(enrichment)
  const threeAct = await inferThreeActThemeBreakdown({
    projectName: scriptTitle,
    logline: enrichment.logline,
    onePageSynopsis: enrichment.onePageSynopsis,
    themeExploration: enrichment.themeExploration,
    sceneOutline
  })
  const treatmentWithActs = threeAct
    ? `${prose.treatment}\n\n${threeAct}`
    : prose.treatment
  const comparableTitles = extractComparableTitlesFromTreatment(prose.treatment)

  const pb = await getAuthenticatedPocketBase()
  const fileSafe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'script.txt'
  const formData = new FormData()
  formData.append('owned_by', userId)
  formData.append('title', scriptTitle)
  formData.append('status', status)
  formData.append('source_filename', filename.slice(0, 500))
  formData.append('script_text', fullScriptText.slice(0, 300000))
  formData.append('synopsis', prose.synopsis.slice(0, 20000))
  formData.append('treatment', treatmentWithActs.slice(0, 50000))
  formData.append('genre', String(enrichment.genre || '').slice(0, 200))
  formData.append('tone', String(enrichment.tone || '').slice(0, 500))
  formData.append('themes', JSON.stringify(enrichment.themes.slice(0, 20)))
  formData.append('comparable_titles', JSON.stringify(comparableTitles))
  const blob = new Blob([fileBuf instanceof Uint8Array ? fileBuf : new Uint8Array(fileBuf)])
  formData.append('file', blob, fileSafe)

  async function createScriptAsset (creativeScriptId: string | null) {
    const assetForm = new FormData()
    assetForm.append('owned_by', userId)
    assetForm.append('kind', 'script')
    assetForm.append('title', scriptTitle)
    assetForm.append('notes', `Script Wizard upload (${status.replace('_', ' ')}).`)
    assetForm.append(
      'metadata',
      JSON.stringify({
        source: 'script_wizard_upload',
        creative_script_id: creativeScriptId || undefined,
        script_title: scriptTitle,
        source_filename: filename.slice(0, 500),
        synopsis: prose.synopsis.slice(0, 20000),
        treatment: treatmentWithActs.slice(0, 50000),
        genre: String(enrichment.genre || '').slice(0, 200),
        tone: String(enrichment.tone || '').slice(0, 500),
        themes: enrichment.themes.slice(0, 20),
        comparable_titles: comparableTitles,
        status
      })
    )
    assetForm.append('sort_order', '0')
    assetForm.append('file', blob, fileSafe)
    return pb.collection('project_assets').create(assetForm)
  }

  try {
    const created = await pb.collection('creative_scripts').create(formData)
    const createdScript = pbRecordToCreativeScript(created as Record<string, unknown>)
    await createScriptAsset(createdScript.id)

    return { script: createdScript }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (isMissingCollectionError(e) && (/creative_scripts/i.test(msg) || /missing collection context/i.test(msg))) {
      const asset = await createScriptAsset(null)
      const now = new Date().toISOString()
      const fallbackScript: CreativeScript = {
        id: String(asset.id || `asset-${Date.now()}`),
        title: scriptTitle,
        status,
        sourceFilename: filename.slice(0, 500),
        scriptText: fullScriptText.slice(0, 300000),
        synopsis: prose.synopsis.slice(0, 20000),
        treatment: treatmentWithActs.slice(0, 50000),
        genre: String(enrichment.genre || '').slice(0, 200),
        tone: String(enrichment.tone || '').slice(0, 500),
        themes: enrichment.themes.slice(0, 20),
        comparableTitles,
        created: String((asset as Record<string, unknown>).created || now),
        updated: String((asset as Record<string, unknown>).updated || now)
      }
      return { script: fallbackScript, warning: 'creative_scripts collection missing; stored as script asset fallback' }
    }
    if (/project_assets/i.test(msg) && /validation|required|project/i.test(msg)) {
      throw createError({
        statusCode: 500,
        message: 'Script saved, but script asset could not be created because project_assets.project is still required. Run: node scripts/add-fields-to-collections.js'
      })
    }
    throw createError({ statusCode: 500, message: msg })
  }
})

