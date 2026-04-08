import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  comparableTitlesFromEnrichment,
  enrichScriptWithAi,
  enrichmentToProjectFields
} from '~/server/utils/script-import-ai'
import { pbProjectAssetToCreativeScript, pbRecordToCreativeScript } from '~/server/utils/creative-script-map'
import {
  resolveScriptWizardSource,
  updateCreativeScriptTreatmentFields,
  updateProjectAssetScriptWizardMetadata
} from '~/server/utils/resolve-script-wizard-source'
import { sceneOutlineAndCharactersFromScriptText } from '~/server/utils/script-wizard-stored-outline'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing script id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const resolved = await resolveScriptWizardSource(pb, userId, id)
  if (!resolved.scriptText.trim()) {
    throw createError({
      statusCode: 400,
      message:
        resolved.kind === 'project_asset'
          ? 'Could not read script text from the uploaded file. Re-upload the screenplay or check file access.'
          : 'No script text stored for this row'
    })
  }

  const title = resolved.title
  const { sceneOutline, characterNames } = sceneOutlineAndCharactersFromScriptText(resolved.scriptText)
  const enrichment = await enrichScriptWithAi({
    projectName: title,
    sceneOutline,
    characterNames
  })
  const prose = enrichmentToProjectFields(enrichment)
  const comparableTitles = comparableTitlesFromEnrichment(enrichment)

  if (resolved.kind === 'creative_script') {
    const updated = await updateCreativeScriptTreatmentFields(pb, id, {
      synopsis: prose.synopsis,
      treatment: prose.treatment,
      genre: String(enrichment.genre || ''),
      tone: String(enrichment.tone || ''),
      themes: enrichment.themes,
      comparable_titles: comparableTitles
    })
    return { script: pbRecordToCreativeScript(updated) }
  }

  const updated = await updateProjectAssetScriptWizardMetadata(pb, id, {
    synopsis: prose.synopsis,
    treatment: prose.treatment,
    genre: String(enrichment.genre || ''),
    tone: String(enrichment.tone || ''),
    themes: enrichment.themes,
    comparable_titles: comparableTitles
  })
  return { script: pbProjectAssetToCreativeScript(updated) }
})
