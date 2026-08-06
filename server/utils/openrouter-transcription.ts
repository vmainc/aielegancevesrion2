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

type OpenRouterVerboseTranscription = {
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
  usage?: { seconds?: number }
}

function openRouterSttHeaders (apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://aielegance.com',
    'X-Title': 'AI Elegance Speech to Text'
  }
  if (process.env.OPENROUTER_REFERER) headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE
  return headers
}

/** Map filename/mime to OpenRouter `input_audio.format`. */
export function audioFormatForOpenRouter (filename: string, mime: string): string {
  const lower = `${filename} ${mime}`.toLowerCase()
  if (/\b(mp3|mpeg|mpga)\b/.test(lower) || lower.includes('audio/mpeg')) return 'mp3'
  if (/\bwav\b/.test(lower) || lower.includes('audio/wav') || lower.includes('audio/wave')) return 'wav'
  if (/\b(m4a|mp4)\b/.test(lower) || lower.includes('audio/mp4') || lower.includes('audio/m4a')) return 'm4a'
  if (/\bwebm\b/.test(lower)) return 'webm'
  if (/\b(ogg|oga|opus)\b/.test(lower)) return 'ogg'
  if (/\bflac\b/.test(lower)) return 'flac'
  if (/\baac\b/.test(lower)) return 'aac'
  const ext = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase()
  if (ext === 'mp3' || ext === 'mpeg' || ext === 'mpga') return 'mp3'
  if (ext === 'wav') return 'wav'
  if (ext === 'm4a') return 'm4a'
  if (ext === 'webm') return 'webm'
  if (ext === 'ogg' || ext === 'oga') return 'ogg'
  if (ext === 'flac') return 'flac'
  if (ext === 'aac') return 'aac'
  return 'mp3'
}

function mapSegments (raw: OpenRouterVerboseTranscription): SpeechToTextSegment[] {
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

async function postTranscription (input: {
  apiKey: string
  model: string
  file: Buffer
  filename: string
  mime: string
  options: SpeechToTextOptions
  responseFormat: 'json' | 'verbose_json'
}): Promise<OpenRouterVerboseTranscription> {
  const format = audioFormatForOpenRouter(input.filename, input.mime)
  const body: Record<string, unknown> = {
    model: input.model,
    input_audio: {
      data: input.file.toString('base64'),
      format
    },
    response_format: input.responseFormat
  }
  if (input.options.language === 'en') {
    body.language = 'en'
  }

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 180_000)
  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: openRouterSttHeaders(input.apiKey),
      body: JSON.stringify(body),
      signal: controller.signal
    })
  } catch (e: unknown) {
    clearTimeout(t)
    if (isAbortLikeError(e)) {
      throw new Error('Transcription timed out. Try a shorter file or retry.')
    }
    throw new Error(e instanceof Error ? e.message : 'Could not reach OpenRouter transcription API.')
  } finally {
    clearTimeout(t)
  }

  const rawText = await res.text()
  if (!res.ok) {
    let msg = `Transcription provider error (${res.status})`
    try {
      const j = JSON.parse(rawText) as {
        error?: { message?: string; code?: string; type?: string }
        message?: string
      }
      if (j?.error?.message) msg = j.error.message
      else if (typeof j?.message === 'string' && j.message.trim()) msg = j.message
      if (res.status === 401) msg = 'OpenRouter API key is invalid or missing.'
      if (res.status === 402) msg = 'OpenRouter credits insufficient for transcription.'
      if (res.status === 429) msg = 'Transcription provider rate limit reached. Wait a moment and retry.'
    } catch {
      if (rawText.trim()) msg = rawText.slice(0, 280)
    }
    const err = new Error(msg) as Error & { statusCode?: number }
    err.statusCode =
      res.status === 401 ? 401 : res.status === 402 ? 402 : res.status === 429 ? 429 : 502
    throw err
  }

  try {
    return JSON.parse(rawText) as OpenRouterVerboseTranscription
  } catch {
    throw new Error('Invalid JSON from transcription provider.')
  }
}

/** Best-effort filler cleanup via OpenRouter chat (Whisper prompt is ignored on OpenRouter). */
async function cleanTranscriptWithOpenRouter (apiKey: string, text: string): Promise<string> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: openRouterSttHeaders(apiKey),
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content:
              'You clean speech transcripts. Remove filler words (um, uh, like, you know) when not meaningful. Fix obvious punctuation and capitalization. Preserve meaning and proper nouns. Do not summarize. Return only the cleaned transcript.'
          },
          { role: 'user', content: text }
        ]
      }),
      signal: controller.signal
    })
    const raw = await res.text()
    if (!res.ok) return text
    const j = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const out = String(j?.choices?.[0]?.message?.content || '').trim()
    return out || text
  } catch {
    return text
  } finally {
    clearTimeout(t)
  }
}

/**
 * OpenRouter speech-to-text adapter (`/api/v1/audio/transcriptions`).
 * Default model: openai/whisper-1. Speaker labels try diarize model, then fall back.
 */
export async function transcribeAudioWithOpenRouter (input: {
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

  let parsed: OpenRouterVerboseTranscription
  try {
    parsed = await postTranscription({
      apiKey: input.apiKey,
      model,
      file: input.file,
      filename: input.filename,
      mime: input.mime,
      options: input.options,
      responseFormat
    })
  } catch (e: unknown) {
    if (wantSpeakers && model === SPEECH_TO_TEXT_DIARIZE_MODEL) {
      warnings.push('Speaker diarization model unavailable — transcribed without speaker labels.')
      model = SPEECH_TO_TEXT_DEFAULT_MODEL
      parsed = await postTranscription({
        apiKey: input.apiKey,
        model,
        file: input.file,
        filename: input.filename,
        mime: input.mime,
        options: { ...input.options, speakerLabels: false },
        responseFormat: wantTimestamps ? 'verbose_json' : 'json'
      })
    } else {
      throw e
    }
  }

  let text = String(parsed.text || '').trim()
  if (!text) {
    throw new Error('No speech detected in this recording.')
  }

  if (input.options.style === 'cleaned') {
    const cleaned = await cleanTranscriptWithOpenRouter(input.apiKey, text)
    if (cleaned && cleaned !== text) {
      text = cleaned
    }
  }

  const segments = mapSegments(parsed)
  const srt = wantTimestamps && segments.length ? segmentsToSrt(segments) : undefined
  const durationSeconds =
    typeof parsed.duration === 'number' && Number.isFinite(parsed.duration)
      ? parsed.duration
      : typeof parsed.usage?.seconds === 'number' && Number.isFinite(parsed.usage.seconds)
        ? parsed.usage.seconds
        : undefined

  return {
    text,
    segments,
    language: typeof parsed.language === 'string' ? parsed.language : undefined,
    durationSeconds,
    model,
    provider: SPEECH_TO_TEXT_PROVIDER,
    srt,
    warnings: warnings.length ? warnings : undefined
  }
}
