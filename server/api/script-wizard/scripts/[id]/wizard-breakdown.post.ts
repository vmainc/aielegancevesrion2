import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  enrichScriptWithAi,
  enrichmentToProjectFields,
  inferThreeActThemeBreakdown
} from '~/server/utils/script-import-ai'
import { pbRecordToCreativeScript } from '~/server/utils/creative-script-map'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { sceneOutlineAndCharactersFromScriptText } from '~/server/utils/script-wizard-stored-outline'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing script id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const row = await pb.collection('creative_scripts').getOne(id)
  const owner = pbRecordOwnerId(row as { owned_by?: unknown; owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const title = String((row as { title?: string }).title || 'Untitled script').slice(0, 500)
  const scriptText = String((row as { script_text?: string }).script_text || '')
  if (!scriptText.trim()) {
    throw createError({ statusCode: 400, message: 'No script text stored for this row' })
  }

  const existing = String((row as { treatment?: string }).treatment || '').trim()
  if (existing && /Three-act thematic breakdown/i.test(existing)) {
    return {
      script: pbRecordToCreativeScript(row as Record<string, unknown>),
      notice: 'This script already has a three-act thematic breakdown.'
    }
  }

  const { sceneOutline, characterNames } = sceneOutlineAndCharactersFromScriptText(scriptText)
  const enrichment = await enrichScriptWithAi({
    projectName: title,
    sceneOutline,
    characterNames
  })
  const prose = enrichmentToProjectFields(enrichment)
  const threeAct = await inferThreeActThemeBreakdown({
    projectName: title,
    logline: enrichment.logline,
    onePageSynopsis: enrichment.onePageSynopsis,
    themeExploration: enrichment.themeExploration,
    sceneOutline
  })

  let newTreatment: string
  if (!existing) {
    newTreatment = [prose.treatment, threeAct].filter(Boolean).join('\n\n')
  } else {
    newTreatment = threeAct ? `${existing}\n\n${threeAct}` : existing
  }

  const updated = await pb.collection('creative_scripts').update(id, {
    treatment: newTreatment.slice(0, 50_000)
  })

  return {
    script: pbRecordToCreativeScript(updated as Record<string, unknown>),
    ...(!threeAct
      ? { notice: 'Breakdown pass returned empty (check OpenRouter / model). Treatment text was still updated if needed.' }
      : {})
  }
})
