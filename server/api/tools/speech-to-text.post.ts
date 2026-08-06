import { readMultipartFormData } from 'h3'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'
import {
  parseSpeechToTextOptions,
  sanitizeSpeechToTextFilename,
  validateSpeechToTextFileMeta,
  SPEECH_TO_TEXT_MAX_BYTES
} from '~/lib/speech-to-text'
import { transcribeAudioWithOpenRouter } from '~/server/utils/openrouter-transcription'
import { prepareAudioForOpenAiTranscription } from '~/server/utils/prepare-audio-for-openai-transcription'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import {
  deleteStagedSpeechToTextAudio,
  getSpeechToTextJob,
  newSpeechToTextJobId,
  pruneOldSpeechToTextFiles,
  registerSpeechToTextJob,
  releaseSpeechToTextSubmitLock,
  speechToTextDuplicateKey,
  stageSpeechToTextAudio,
  tryAcquireSpeechToTextSubmitLock,
  updateSpeechToTextJob
} from '~/server/utils/speech-to-text-store'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  checkRateLimit(rateLimitKey(userId, 'speech-to-text'), 8, 60_000)

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throwApiError(
      500,
      ApiErrorCode.OPENROUTER_NOT_CONFIGURED,
      'OpenRouter API key not configured. Set OPENROUTER_API_KEY or NUXT_OPENROUTER_API_KEY.'
    )
  }

  void pruneOldSpeechToTextFiles()

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Expected multipart form data with an audio file.')
  }

  let filePart: { data: Buffer; filename?: string; type?: string } | null = null
  let optionsRaw: unknown = {}

  for (const part of parts) {
    const name = String(part.name || '')
    if (name === 'file' && part.data) {
      filePart = {
        data: Buffer.from(part.data),
        filename: part.filename,
        type: part.type
      }
    } else if (name === 'options' && part.data) {
      try {
        optionsRaw = JSON.parse(Buffer.from(part.data).toString('utf8'))
      } catch {
        optionsRaw = {}
      }
    }
  }

  if (!filePart) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Audio file is required (field name: file).')
  }

  const filename = sanitizeSpeechToTextFilename(filePart.filename || 'audio.mp3')
  const mime = String(filePart.type || '').toLowerCase()
  const size = filePart.data.length

  const validationError = validateSpeechToTextFileMeta({ filename, mime, size })
  if (validationError) {
    const code = size > SPEECH_TO_TEXT_MAX_BYTES ? 413 : 400
    throwApiError(code, ApiErrorCode.VALIDATION_ERROR, validationError)
  }

  const options = parseSpeechToTextOptions(optionsRaw)
  const lockKey = speechToTextDuplicateKey(userId, filename, size)
  if (!tryAcquireSpeechToTextSubmitLock(lockKey)) {
    throwApiError(
      409,
      ApiErrorCode.VALIDATION_ERROR,
      'A transcription for this file is already in progress. Wait for it to finish or retry later.'
    )
  }

  const jobId = newSpeechToTextJobId()
  let stagedPath: string | undefined

  try {
    stagedPath = await stageSpeechToTextAudio({
      jobId,
      filename,
      data: filePart.data
    })

    registerSpeechToTextJob(jobId, {
      status: 'transcribing',
      phase: 'uploading',
      userId,
      filename,
      mime,
      size,
      options,
      stagedPath
    })

    // Process async so the browser can poll (avoids fragile long-lived POST).
    void (async () => {
      try {
        updateSpeechToTextJob(jobId, { phase: 'transcribing', status: 'transcribing' })
        const prepared = await prepareAudioForOpenAiTranscription({
          data: filePart!.data,
          filename,
          mime: mime || 'application/octet-stream'
        })
        const result = await transcribeAudioWithOpenRouter({
          apiKey,
          file: prepared.data,
          filename: prepared.filename,
          mime: prepared.mime,
          options
        })
        if (prepared.compressed) {
          result.warnings = [
            ...(result.warnings || []),
            'Audio was compressed to fit the transcription provider size limit.'
          ]
        }
        updateSpeechToTextJob(jobId, {
          status: 'completed',
          result,
          completedAt: Date.now(),
          // Reserved for future credit metering — never double-charge on retry.
          usageCharged: false
        })
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message.slice(0, 500) : 'Transcription failed.'
        updateSpeechToTextJob(jobId, {
          status: 'failed',
          message,
          completedAt: Date.now()
        })
      } finally {
        const job = getSpeechToTextJob(jobId)
        await deleteStagedSpeechToTextAudio(job?.stagedPath || stagedPath)
        updateSpeechToTextJob(jobId, { stagedPath: undefined })
        releaseSpeechToTextSubmitLock(lockKey)
      }
    })()

    setResponseStatus(event, 202)
    return {
      jobId,
      status: 'transcribing' as const,
      phase: 'uploading' as const
    }
  } catch (e: unknown) {
    releaseSpeechToTextSubmitLock(lockKey)
    await deleteStagedSpeechToTextAudio(stagedPath)
    const message = e instanceof Error ? e.message : 'Could not start transcription.'
    throwApiError(500, ApiErrorCode.BAD_GATEWAY, message)
  }
})
