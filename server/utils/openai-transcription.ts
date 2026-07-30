import {
  SPEECH_TO_TEXT_DEFAULT_MODEL,
  SPEECH_TO_TEXT_DIARIZE_MODEL,
  SPEECH_TO_TEXT_PROVIDER,
  segmentsToSrt,
  type SpeechToTextOptions,
  type SpeechToTextResult,
  type SpeechToTextSegment
} from '~/lib/speech-to-text'
import { isAbortLikeError } from '~/server/utils/api-error-envelope'

export function resolveOpenAiApiKey (config: { openaiApiKey?: string }): string | undefined {
  const v =
    (config.openaiApiKey && String(config.openaiApiKey).trim()) ||
    process.env.NUXT_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY
  const s = v ? String(v).trim() : ''
  return s || undefined
}

type OpenAiVerboseTranscription = {
  text?: string
  language?: string
  duration?: number
  segments?: Array<{
    id?: number
    start?: number
    end?: number
    text?: string
    speaker?: string
  }>
  words?: Array<{ word?: string; start?: number; end?: number; speaker?: string }>
}

function mapSegments (raw: OpenAiVerboseTranscription): SpeechToTextSegment[] {
  if (Array.isArray(raw.segments) && raw.segments.length) {
    return raw.segments
      .map((s, i) => ({
        id: typeof s.id === 'number' ? s.id : i,
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        text: String(s.text || '').trim(),
        speaker: typeof s.speaker === 'string' && s.speaker.trim() ? s.speaker.trim() : undefined
      }))
      .filter(s => s.text)
  }
  return []
}

function stylePrompt (style: SpeechToTextOptions['style']): string {
  if (style === 'cleaned') {
    return 'Clean transcription: remove filler words such as um, uh, like, and you know when they are not meaningful. Fix obvious punctuation and capitalization. Preserve meaning and proper nouns. Do not summarize.'
  }
  return 'Verbatim transcription: preserve filler words, false starts, and repetitions. Keep the speaker wording as spoken. Use clear punctuation where possible.'
}

async function postTranscription (input: {
  apiKey: string
  model: string
  file: Buffer
  filename: string
  mime: string
  options: SpeechToTextOptions
  responseFormat: 'json' | 'verbose_json' | 'text'
}): Promise<OpenAiVerboseTranscription | string> {
  const form = new FormData()
  const blob = new Blob([new Uint8Array(input.file)], {
    type: input.mime || 'application/octet-stream'
  })
  form.append('file', blob, input.filename)
  form.append('model', input.model)
  form.append('response_format', input.responseFormat)
  form.append('prompt', stylePrompt(input.options.style))
  if (input.options.language === 'en') {
    form.append('language', 'en')
  }

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 180_000)
  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`
      },
      body: form,
      signal: controller.signal
    })
  } catch (e: unknown) {
    clearTimeout(t)
    if (isAbortLikeError(e)) {
      throw new Error('Transcription timed out. Try a shorter file or retry.')
    }
    throw new Error(e instanceof Error ? e.message : 'Could not reach OpenAI transcription API.')
  } finally {
    clearTimeout(t)
  }

  const rawText = await res.text()
  if (!res.ok) {
    let msg = `Transcription provider error (${res.status})`
    try {
      const j = JSON.parse(rawText) as { error?: { message?: string; code?: string; type?: string } }
      if (j?.error?.message) msg = j.error.message
      if (res.status === 401) msg = 'OpenAI API key is invalid or missing.'
      if (res.status === 429) msg = 'Transcription provider rate limit reached. Wait a moment and retry.'
    } catch {
      if (rawText.trim()) msg = rawText.slice(0, 280)
    }
    const err = new Error(msg) as Error & { statusCode?: number }
    err.statusCode = res.status === 401 ? 401 : res.status === 429 ? 429 : 502
    throw err
  }

  if (input.responseFormat === 'text') {
    return rawText
  }

  try {
    return JSON.parse(rawText) as OpenAiVerboseTranscription
  } catch {
    throw new Error('Invalid JSON from transcription provider.')
  }
}

/**
 * OpenAI audio transcription adapter.
 * Uses whisper-1 by default (timestamps via verbose_json).
 * Speaker labels use gpt-4o-transcribe-diarize when requested (experimental).
 */
export async function transcribeAudioWithOpenAi (input: {
  apiKey: string
  file: Buffer
  filename: string
  mime: string
  options: SpeechToTextOptions
}): Promise<SpeechToTextResult> {
  const warnings: string[] = []
  let model = SPEECH_TO_TEXT_DEFAULT_MODEL
  const wantSpeakers = input.options.speakerLabels
  const wantTimestamps = input.options.timestamps

  if (wantSpeakers) {
    model = SPEECH_TO_TEXT_DIARIZE_MODEL
    warnings.push('Speaker labels are experimental and may be incomplete on overlapping speech.')
  }

  const responseFormat: 'json' | 'verbose_json' =
    wantTimestamps || wantSpeakers ? 'verbose_json' : 'json'

  let parsed: OpenAiVerboseTranscription
  try {
    const out = await postTranscription({
      apiKey: input.apiKey,
      model,
      file: input.file,
      filename: input.filename,
      mime: input.mime,
      options: input.options,
      responseFormat
    })
    if (typeof out === 'string') {
      parsed = { text: out }
    } else {
      parsed = out
    }
  } catch (e: unknown) {
    // Fall back from diarize model to whisper-1
    if (wantSpeakers && model === SPEECH_TO_TEXT_DIARIZE_MODEL) {
      warnings.push('Speaker diarization model unavailable — transcribed without speaker labels.')
      model = SPEECH_TO_TEXT_DEFAULT_MODEL
      const out = await postTranscription({
        apiKey: input.apiKey,
        model,
        file: input.file,
        filename: input.filename,
        mime: input.mime,
        options: { ...input.options, speakerLabels: false },
        responseFormat: wantTimestamps ? 'verbose_json' : 'json'
      })
      parsed = typeof out === 'string' ? { text: out } : out
    } else {
      throw e
    }
  }

  const text = String(parsed.text || '').trim()
  if (!text) {
    throw new Error('No speech detected in this recording.')
  }

  const segments = mapSegments(parsed)
  const srt =
    wantTimestamps && segments.length
      ? segmentsToSrt(segments)
      : undefined

  return {
    text,
    segments,
    language: typeof parsed.language === 'string' ? parsed.language : undefined,
    durationSeconds:
      typeof parsed.duration === 'number' && Number.isFinite(parsed.duration)
        ? parsed.duration
        : undefined,
    model,
    provider: SPEECH_TO_TEXT_PROVIDER,
    srt,
    warnings: warnings.length ? warnings : undefined
  }
}
