import {
  LYRIA_CLIP_MODEL_ID,
  LYRIA_PRO_MODEL_ID
} from '~/lib/music-generation-models'

export type MusicGuidePurpose =
  | 'film_score'
  | 'theme_song'
  | 'mood_bed'
  | 'promo'
  | 'other'

export type MusicGuideLength = 'clip' | 'full'

export type MusicGuideVocals =
  | 'instrumental'
  | 'own_lyrics'
  | 'generate_lyrics'

export type MusicGuideBrief = {
  /** Freeform user request — primary creative input. */
  intent: string
  purpose: MusicGuidePurpose | ''
  purposeOther: string
  length: MusicGuideLength | ''
  vocals: MusicGuideVocals | ''
  ownLyrics: string
  mood: string
  bpm: number | null
  /** Optional AI-built Lyria prompt; falls back to a local builder. */
  compositionPrompt: string
  saveToProject: boolean
  projectId: string
}

export type MusicGuideAnalyzeResult = {
  purpose: MusicGuidePurpose
  purposeOther?: string
  length: MusicGuideLength
  vocals: MusicGuideVocals
  ownLyrics?: string
  mood: string
  bpm?: number | null
  compositionPrompt: string
}

export const MUSIC_GUIDE_PURPOSE_OPTIONS: {
  id: MusicGuidePurpose
  label: string
  hint: string
}[] = [
  {
    id: 'film_score',
    label: 'Film / scene score',
    hint: 'Underscore that supports picture and emotion'
  },
  {
    id: 'theme_song',
    label: 'Theme or title song',
    hint: 'Memorable motif or vocal theme for a project'
  },
  {
    id: 'mood_bed',
    label: 'Mood bed / ambient',
    hint: 'Loopable atmosphere for cuts, waits, or montages'
  },
  {
    id: 'promo',
    label: 'Promo / trailer sting',
    hint: 'Short punchy music for ads or trailers'
  },
  {
    id: 'other',
    label: 'Something else',
    hint: 'Describe what you need in your own words'
  }
]

export const MUSIC_GUIDE_LENGTH_OPTIONS: {
  id: MusicGuideLength
  label: string
  hint: string
  modelId: string
}[] = [
  {
    id: 'clip',
    label: 'Short clip (~30s)',
    hint: 'Lyria 3 Clip — quick ideas and beds',
    modelId: LYRIA_CLIP_MODEL_ID
  },
  {
    id: 'full',
    label: 'Full track (~3 min)',
    hint: 'Lyria 3 Pro — longer songs and themes',
    modelId: LYRIA_PRO_MODEL_ID
  }
]

export const MUSIC_GUIDE_VOCAL_OPTIONS: {
  id: MusicGuideVocals
  label: string
  hint: string
}[] = [
  {
    id: 'instrumental',
    label: 'Instrumental only',
    hint: 'No vocals — best for film beds and underscore'
  },
  {
    id: 'own_lyrics',
    label: 'I have lyrics',
    hint: 'Paste your lyrics; Pro works best for vocal songs'
  },
  {
    id: 'generate_lyrics',
    label: 'Generate lyrics for me',
    hint: 'We’ll draft lyrics from your request, then compose'
  }
]

export function emptyMusicGuideBrief (): MusicGuideBrief {
  return {
    intent: '',
    purpose: '',
    purposeOther: '',
    length: '',
    vocals: '',
    ownLyrics: '',
    mood: '',
    bpm: null,
    compositionPrompt: '',
    saveToProject: true,
    projectId: ''
  }
}

export type MusicGuideFormState = {
  prompt: string
  modelId: string
  instrumental: boolean
  lyrics: string
  bpm: number | null
  saveToProject: boolean
  projectId: string
  needsGeneratedLyrics: boolean
}

function purposePhrase (brief: MusicGuideBrief): string {
  switch (brief.purpose) {
    case 'film_score':
      return 'cinematic film score underscore for a scene'
    case 'theme_song':
      return 'memorable theme song or title motif'
    case 'mood_bed':
      return 'atmospheric mood bed suitable for looping under picture'
    case 'promo':
      return 'promo or trailer sting with clear impact and payoff'
    case 'other':
      return (brief.purposeOther.trim() || brief.intent.trim() || 'custom music cue').slice(0, 200)
    default:
      return brief.intent.trim().slice(0, 200) || 'music cue'
  }
}

function buildLocalCompositionPrompt (brief: MusicGuideBrief): string {
  const intent = brief.intent.trim()
  const mood = brief.mood.trim()
  const lines: string[] = []
  if (intent) lines.push(intent)
  else lines.push(`Create a ${purposePhrase(brief)}.`)
  if (mood) lines.push(`Mood and style: ${mood}.`)
  if (brief.purpose && brief.purpose !== 'other') {
    lines.push(`Use case: ${purposePhrase(brief)}.`)
  } else if (brief.purpose === 'other' && brief.purposeOther.trim()) {
    lines.push(`Use case: ${brief.purposeOther.trim()}.`)
  }
  lines.push('High production value, clear arrangement, suitable for picture or standalone listening.')
  return lines.join(' ')
}

/** Build Lyria prompt + form fields from a completed guide brief. */
export function musicGuideBriefToFormState (brief: MusicGuideBrief): MusicGuideFormState {
  const lengthOpt = MUSIC_GUIDE_LENGTH_OPTIONS.find(o => o.id === brief.length)
  const modelId = lengthOpt?.modelId || LYRIA_CLIP_MODEL_ID
  const instrumental = brief.vocals === 'instrumental' || !brief.vocals
  const prompt = brief.compositionPrompt.trim() || buildLocalCompositionPrompt(brief)

  return {
    prompt,
    modelId,
    instrumental,
    lyrics: brief.vocals === 'own_lyrics' ? brief.ownLyrics.trim() : '',
    bpm: brief.bpm,
    saveToProject: brief.saveToProject,
    projectId: brief.projectId,
    needsGeneratedLyrics: brief.vocals === 'generate_lyrics'
  }
}

export function musicGuideLyricsSeed (brief: MusicGuideBrief): string {
  const intent = brief.intent.trim()
  const mood = brief.mood.trim() || 'fitting the request'
  if (intent) {
    return `Write original song lyrics for this music request: ${intent}. Mood and style: ${mood}. Keep structure with verse and chorus. Match the emotional tone; no stage directions.`
  }
  return `Write original song lyrics for a ${purposePhrase(brief)}. Mood and style: ${mood}. Keep structure with verse and chorus. Match the emotional tone; no stage directions.`
}

export type MusicGuideStep = 'intent' | 'save' | 'review'

export const MUSIC_GUIDE_STEPS: MusicGuideStep[] = ['intent', 'save', 'review']

export function musicGuideStepIndex (step: MusicGuideStep): number {
  return MUSIC_GUIDE_STEPS.indexOf(step)
}

export function canAdvanceMusicGuideStep (
  step: MusicGuideStep,
  brief: MusicGuideBrief
): boolean {
  switch (step) {
    case 'intent':
      return brief.intent.trim().length >= 8
    case 'save':
      if (!brief.saveToProject) return true
      return Boolean(brief.projectId.trim())
    case 'review':
      return Boolean(brief.length && brief.vocals && (brief.mood.trim() || brief.compositionPrompt.trim() || brief.intent.trim()))
    default:
      return false
  }
}

const PURPOSES = new Set<MusicGuidePurpose>([
  'film_score',
  'theme_song',
  'mood_bed',
  'promo',
  'other'
])
const LENGTHS = new Set<MusicGuideLength>(['clip', 'full'])
const VOCALS = new Set<MusicGuideVocals>(['instrumental', 'own_lyrics', 'generate_lyrics'])

/** Apply AI (or heuristic) analyze result onto a brief. Preserves intent/save fields. */
export function applyMusicGuideAnalyzeResult (
  brief: MusicGuideBrief,
  result: MusicGuideAnalyzeResult
): void {
  brief.purpose = PURPOSES.has(result.purpose) ? result.purpose : 'other'
  brief.purposeOther = (result.purposeOther || '').trim().slice(0, 200)
  brief.length = LENGTHS.has(result.length) ? result.length : 'full'
  brief.vocals = VOCALS.has(result.vocals) ? result.vocals : 'instrumental'
  brief.ownLyrics = (result.ownLyrics || '').trim()
  brief.mood = (result.mood || '').trim().slice(0, 500)
  brief.bpm =
    typeof result.bpm === 'number' && Number.isFinite(result.bpm) && result.bpm > 0
      ? Math.round(result.bpm)
      : null
  brief.compositionPrompt = (result.compositionPrompt || '').trim().slice(0, 4000)
}

/** Offline fallback when the analyze API is unavailable. */
export function heuristicMusicGuideAnalyze (intent: string): MusicGuideAnalyzeResult {
  const t = intent.trim()
  const lower = t.toLowerCase()
  const wantsVocals =
    /\b(song|lyrics|sing|vocal|rap|ballad|anthem|about\s+\w+)\b/i.test(lower) &&
    !/\b(instrumental|score|underscore|bed|no\s+vocals?)\b/i.test(lower)
  const wantsShort =
    /\b(short|sting|clip|30\s*s|thirty|jingle|bumper|intro)\b/i.test(lower)
  const wantsScore =
    /\b(score|underscore|film|scene|cinematic|trailer)\b/i.test(lower)

  let purpose: MusicGuidePurpose = 'other'
  if (wantsScore) purpose = 'film_score'
  else if (/\b(theme|title\s*song)\b/i.test(lower)) purpose = 'theme_song'
  else if (/\b(ambient|mood\s*bed|loop|atmosphere)\b/i.test(lower)) purpose = 'mood_bed'
  else if (/\b(promo|ad|commercial|trailer\s*sting)\b/i.test(lower)) purpose = 'promo'
  else if (wantsVocals) purpose = 'theme_song'

  const length: MusicGuideLength = wantsShort ? 'clip' : wantsVocals ? 'full' : 'clip'
  const vocals: MusicGuideVocals = wantsVocals ? 'generate_lyrics' : 'instrumental'

  return {
    purpose,
    purposeOther: purpose === 'other' ? t.slice(0, 200) : '',
    length,
    vocals,
    mood: t.slice(0, 280),
    bpm: null,
    compositionPrompt: `${t} High production value, clear arrangement, suitable for picture or standalone listening.`
  }
}

export function parseMusicGuideAnalyzeJson (raw: string): MusicGuideAnalyzeResult | null {
  const text = raw.trim()
  if (!text) return null
  let parsed: unknown
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    parsed = JSON.parse(fenced ? fenced[1].trim() : text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      parsed = JSON.parse(text.slice(start, end + 1))
    } catch {
      return null
    }
  }
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>
  const purpose = String(o.purpose || '') as MusicGuidePurpose
  const length = String(o.length || '') as MusicGuideLength
  const vocals = String(o.vocals || '') as MusicGuideVocals
  const mood = String(o.mood || '').trim()
  const compositionPrompt = String(o.compositionPrompt || o.prompt || '').trim()
  if (!PURPOSES.has(purpose) || !LENGTHS.has(length) || !VOCALS.has(vocals)) return null
  if (!mood && !compositionPrompt) return null

  let bpm: number | null = null
  if (typeof o.bpm === 'number' && Number.isFinite(o.bpm) && o.bpm > 0) {
    bpm = Math.round(o.bpm)
  } else if (typeof o.bpm === 'string' && o.bpm.trim()) {
    const n = Number(o.bpm)
    if (Number.isFinite(n) && n > 0) bpm = Math.round(n)
  }

  return {
    purpose,
    purposeOther: String(o.purposeOther || '').trim().slice(0, 200),
    length,
    vocals,
    ownLyrics: String(o.ownLyrics || '').trim(),
    mood: mood.slice(0, 500) || compositionPrompt.slice(0, 280),
    bpm,
    compositionPrompt: compositionPrompt.slice(0, 4000)
  }
}
