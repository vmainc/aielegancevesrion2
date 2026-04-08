import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  enrichScriptWithAi,
  enrichmentToProjectFields,
  inferThreeActThemeBreakdown
} from '~/server/utils/script-import-ai'
import { pbProjectAssetToCreativeScript, pbRecordToCreativeScript } from '~/server/utils/creative-script-map'
import {
  mergeProjectAssetTreatment,
  resolveScriptWizardSource,
  updateCreativeScriptTreatmentOnly
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

  const existing = resolved.existingTreatment.trim()
  if (existing && /Three-act thematic breakdown/i.test(existing)) {
    const script =
      resolved.kind === 'creative_script'
        ? pbRecordToCreativeScript(resolved.row)
        : pbProjectAssetToCreativeScript(resolved.row)
    return {
      script,
      notice: 'This script already has a three-act thematic breakdown.'
    }
  }

  const title = resolved.title
  const { sceneOutline, characterNames } = sceneOutlineAndCharactersFromScriptText(resolved.scriptText)
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

  const updated =
    resolved.kind === 'creative_script'
      ? await updateCreativeScriptTreatmentOnly(pb, id, newTreatment)
      : await mergeProjectAssetTreatment(pb, id, newTreatment.slice(0, 50_000))

  const script =
    resolved.kind === 'creative_script'
      ? pbRecordToCreativeScript(updated)
      : pbProjectAssetToCreativeScript(updated)

  return {
    script,
    ...(!threeAct
      ? { notice: 'Breakdown pass returned empty (check OpenRouter / model). Treatment text was still updated if needed.' }
      : {})
  }
})
