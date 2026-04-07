import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  comparableTitlesFromEnrichment,
  enrichScriptWithAi,
  enrichmentToProjectFields
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

  const { sceneOutline, characterNames } = sceneOutlineAndCharactersFromScriptText(scriptText)
  const enrichment = await enrichScriptWithAi({
    projectName: title,
    sceneOutline,
    characterNames
  })
  const prose = enrichmentToProjectFields(enrichment)
  const comparableTitles = comparableTitlesFromEnrichment(enrichment)

  const updated = await pb.collection('creative_scripts').update(id, {
    synopsis: prose.synopsis.slice(0, 20_000),
    treatment: prose.treatment.slice(0, 50_000),
    genre: String(enrichment.genre || '').slice(0, 200),
    tone: String(enrichment.tone || '').slice(0, 500),
    themes: enrichment.themes.slice(0, 20),
    comparable_titles: comparableTitles
  })

  return {
    script: pbRecordToCreativeScript(updated as Record<string, unknown>)
  }
})
