import { createError, readBody } from 'h3'
import {
  buildVoiceoverSpeechInput,
  DEFAULT_VOICEOVER_MODEL_ID,
  defaultVoiceForModel,
  getVoiceoverModel,
  isVoiceoverModelId
} from '~/lib/voiceover-generation-models'
import { openRouterGenerateVoiceover } from '~/server/utils/openrouter-generate-voiceover'
import {
  newVoiceoverGenerationResultId,
  pruneOldVoiceoverGenerationResults,
  saveVoiceoverGenerationResult,
  voiceoverResultPlaybackPath
} from '~/server/utils/voiceover-generation-store'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

export default defineEventHandler(async (event) => {
  await getPocketBaseUserIdFromRequest(event)
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenRouter API key not configured'
    })
  }

  const body = await readBody(event).catch(() => ({}))
  const scriptRaw = typeof body?.script === 'string' ? body.script : typeof body?.prompt === 'string' ? body.prompt : ''
  const script = buildVoiceoverSpeechInput(scriptRaw)
  if (!script) {
    throw createError({ statusCode: 400, message: 'Script is required — enter the words to speak.' })
  }
  if (script.length < 2) {
    throw createError({ statusCode: 400, message: 'Script is too short.' })
  }

  const modelRaw = typeof body?.model === 'string' ? body.model.trim() : DEFAULT_VOICEOVER_MODEL_ID
  const model = isVoiceoverModelId(modelRaw) ? modelRaw : DEFAULT_VOICEOVER_MODEL_ID
  const modelMeta = getVoiceoverModel(model)

  const voiceRaw = typeof body?.voice === 'string' ? body.voice.trim() : ''
  const voiceOk = modelMeta?.voices.some((v) => v.id === voiceRaw)
  const voice = voiceOk ? voiceRaw : defaultVoiceForModel(model)

  const deliveryNotes =
    typeof body?.deliveryNotes === 'string'
      ? body.deliveryNotes
      : typeof body?.delivery === 'string'
        ? body.delivery
        : ''

  const speedRaw = body?.speed
  const speed =
    typeof speedRaw === 'number' && Number.isFinite(speedRaw)
      ? speedRaw
      : typeof speedRaw === 'string' && speedRaw.trim()
        ? Number(speedRaw)
        : null

  void pruneOldVoiceoverGenerationResults()

  try {
    const { buffer } = await openRouterGenerateVoiceover({
      script,
      model,
      voice,
      apiKey,
      deliveryNotes,
      speed
    })
    const resultId = newVoiceoverGenerationResultId()
    await saveVoiceoverGenerationResult(resultId, buffer)
    return {
      resultId,
      playbackUrl: voiceoverResultPlaybackPath(resultId),
      model,
      voice,
      script,
      deliveryNotes: deliveryNotes.trim().slice(0, 2000)
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Voiceover generation failed'
    throw createError({
      statusCode: 502,
      message: message.trim() || 'Voiceover generation failed'
    })
  }
})
