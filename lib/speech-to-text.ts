/** Speech-to-text tool — shared types, validation, and formatting (client + server). */

export const SPEECH_TO_TEXT_MAX_BYTES = 100 * 1024 * 1024

/** OpenRouter multipart / upstream Whisper body limit — larger uploads are compressed first. */
export const SPEECH_TO_TEXT_PROVIDER_MAX_BYTES = 25 * 1024 * 1024

/**
 * Placeholder for future credit / usage metering.
 * Primary unit is audio duration (minutes). Not charged until a billing system exists.
 * Set to a positive number when wiring credits; keep null/0 to mean “not billed”.
 */
export const SPEECH_TO_TEXT_CREDITS_PER_AUDIO_MINUTE: number | null = null

export const SPEECH_TO_TEXT_PROVIDER = 'openrouter'
export const SPEECH_TO_TEXT_DEFAULT_MODEL = 'openai/whisper-1'
export const SPEECH_TO_TEXT_DIARIZE_MODEL = 'openai/gpt-4o-transcribe-diarize'

export type SpeechToTextStyle = 'verbatim' | 'cleaned'
export type SpeechToTextLanguage = 'auto' | 'en'

export type SpeechToTextSegment = {
  id: number
  start: number
  end: number
  text: string
  speaker?: string
}

export type SpeechToTextOptions = {
  style: SpeechToTextStyle
  language: SpeechToTextLanguage
  speakerLabels: boolean
  timestamps: boolean
}

export type SpeechToTextJobStatus = 'queued' | 'uploading' | 'transcribing' | 'completed' | 'failed'

export type SpeechToTextResult = {
  text: string
  segments: SpeechToTextSegment[]
  language?: string
  durationSeconds?: number
  model: string
  provider: string
  srt?: string
  warnings?: string[]
}

export type SpeechToTextHistoryItem = {
  id: string
  filename: string
  createdAt: string
  status: 'completed' | 'failed'
  text?: string
  wordCount?: number
  durationSeconds?: number
  error?: string
}

export const SPEECH_TO_TEXT_ACCEPT_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.webm', '.mpeg', '.mpga', '.ogg'] as const

export const SPEECH_TO_TEXT_ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/webm',
  'audio/ogg',
  'audio/oga',
  'video/webm', // some browsers label webm audio this way
  'application/octet-stream' // allow with extension check
])

const EXT_RE = /\.(mp3|wav|m4a|webm|mpeg|mpga|ogg|oga)$/i

export function sanitizeSpeechToTextFilename (raw: string): string {
  const base = String(raw || 'audio')
    .replace(/^.*[/\\]/, '') // drop path segments
    .replace(/[?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
  return base || 'audio'
}

export function speechToTextExtension (filename: string): string {
  const m = EXT_RE.exec(filename)
  return m ? `.${m[1]!.toLowerCase()}` : ''
}

export function isAllowedSpeechToTextMime (mime: string, filename: string): boolean {
  const type = (mime || '').toLowerCase().trim()
  const ext = speechToTextExtension(filename)
  if (!ext) return false
  if (!type || type === 'application/octet-stream') return true
  return SPEECH_TO_TEXT_ALLOWED_MIME.has(type)
}

export function validateSpeechToTextFileMeta (input: {
  filename: string
  mime: string
  size: number
}): string | null {
  const filename = sanitizeSpeechToTextFilename(input.filename)
  if (!speechToTextExtension(filename)) {
    return `Unsupported file type. Use ${SPEECH_TO_TEXT_ACCEPT_EXTENSIONS.join(', ')}.`
  }
  if (!isAllowedSpeechToTextMime(input.mime, filename)) {
    return `Unsupported audio type (${input.mime || 'unknown'}). Use MP3, WAV, M4A, or WebM.`
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return 'The audio file is empty or corrupt.'
  }
  if (input.size > SPEECH_TO_TEXT_MAX_BYTES) {
    return `File is too large (max ${Math.floor(SPEECH_TO_TEXT_MAX_BYTES / (1024 * 1024))} MB). Compress or trim the recording.`
  }
  return null
}

export function formatSpeechToTextBytes (bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatSpeechToTextDuration (seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r}s`
  return `${m}:${String(r).padStart(2, '0')}`
}

export function countTranscriptWords (text: string): number {
  const parts = text.trim().split(/\s+/).filter(Boolean)
  return parts.length
}

function srtTimestamp (seconds: number): string {
  const msTotal = Math.max(0, Math.round(seconds * 1000))
  const ms = msTotal % 1000
  const totalSec = Math.floor(msTotal / 1000)
  const s = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const m = totalMin % 60
  const h = Math.floor(totalMin / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function segmentsToSrt (segments: SpeechToTextSegment[]): string {
  if (!segments.length) return ''
  return segments
    .map((seg, i) => {
      const speaker = seg.speaker ? `${seg.speaker}: ` : ''
      const body = `${speaker}${seg.text.trim()}`.trim()
      return `${i + 1}\n${srtTimestamp(seg.start)} --> ${srtTimestamp(seg.end)}\n${body}\n`
    })
    .join('\n')
    .trim() + '\n'
}

export function formatTranscriptWithTimestamps (
  text: string,
  segments: SpeechToTextSegment[],
  includeTimestamps: boolean
): string {
  if (!includeTimestamps || !segments.length) return text.trim()
  return segments
    .map((seg) => {
      const stamp = `[${formatSpeechToTextDuration(seg.start)}]`
      const speaker = seg.speaker ? ` ${seg.speaker}:` : ''
      return `${stamp}${speaker} ${seg.text.trim()}`.trim()
    })
    .join('\n\n')
}

export function parseSpeechToTextOptions (raw: unknown): SpeechToTextOptions {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const style: SpeechToTextStyle = o.style === 'cleaned' ? 'cleaned' : 'verbatim'
  const language: SpeechToTextLanguage = o.language === 'en' ? 'en' : 'auto'
  return {
    style,
    language,
    speakerLabels: o.speakerLabels === true || o.speaker_labels === true,
    timestamps: o.timestamps === true
  }
}

const HISTORY_KEY = 'aielegance-speech-to-text-history'

export function loadSpeechToTextHistory (): SpeechToTextHistoryItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is SpeechToTextHistoryItem => {
        if (!item || typeof item !== 'object') return false
        const h = item as SpeechToTextHistoryItem
        return typeof h.id === 'string' && typeof h.filename === 'string' && typeof h.createdAt === 'string'
      })
      .slice(0, 20)
  } catch {
    return []
  }
}

export function saveSpeechToTextHistory (items: SpeechToTextHistoryItem[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)))
  } catch {
    /* quota */
  }
}

export function upsertSpeechToTextHistory (
  current: SpeechToTextHistoryItem[],
  item: SpeechToTextHistoryItem
): SpeechToTextHistoryItem[] {
  const next = [item, ...current.filter(h => h.id !== item.id)].slice(0, 20)
  saveSpeechToTextHistory(next)
  return next
}

export function removeSpeechToTextHistory (
  current: SpeechToTextHistoryItem[],
  id: string
): SpeechToTextHistoryItem[] {
  const next = current.filter(h => h.id !== id)
  saveSpeechToTextHistory(next)
  return next
}
