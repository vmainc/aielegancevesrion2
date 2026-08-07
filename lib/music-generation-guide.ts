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
  purpose: MusicGuidePurpose | ''
  purposeOther: string
  length: MusicGuideLength | ''
  vocals: MusicGuideVocals | ''
  ownLyrics: string
  mood: string
  bpm: number | null
  saveToProject: boolean
  projectId: string
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
    hint: 'We’ll draft lyrics from your mood, then compose'
  }
]

export const MUSIC_GUIDE_MOOD_CHIPS = [
  'Dark and tense',
  'Warm and hopeful',
  'Dreamy ambient',
  'Driving and urgent',
  'Intimate and quiet',
  'Epic and majestic',
  'Playful and light',
  'Melancholy'
] as const

export function emptyMusicGuideBrief (): MusicGuideBrief {
  return {
    purpose: '',
    purposeOther: '',
    length: '',
    vocals: '',
    ownLyrics: '',
    mood: '',
    bpm: null,
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
      return (brief.purposeOther.trim() || 'custom music cue').slice(0, 200)
    default:
      return 'music cue'
  }
}

/** Build Lyria prompt + form fields from a completed guide brief. */
export function musicGuideBriefToFormState (brief: MusicGuideBrief): MusicGuideFormState {
  const lengthOpt = MUSIC_GUIDE_LENGTH_OPTIONS.find(o => o.id === brief.length)
  const modelId = lengthOpt?.modelId || LYRIA_CLIP_MODEL_ID
  const instrumental = brief.vocals === 'instrumental' || !brief.vocals
  const mood = brief.mood.trim() || 'cinematic and cohesive'
  const prompt = [
    `Create a ${purposePhrase(brief)}.`,
    `Mood and style: ${mood}.`,
    'High production value, clear arrangement, suitable for picture or standalone listening.'
  ].join(' ')

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
  const mood = brief.mood.trim() || 'cinematic'
  return `Write original song lyrics for a ${purposePhrase(brief)}. Mood and style: ${mood}. Keep structure with verse and chorus. Match the emotional tone; no stage directions.`
}

export type MusicGuideStep =
  | 'purpose'
  | 'length'
  | 'vocals'
  | 'mood'
  | 'save'
  | 'review'

export const MUSIC_GUIDE_STEPS: MusicGuideStep[] = [
  'purpose',
  'length',
  'vocals',
  'mood',
  'save',
  'review'
]

export function musicGuideStepIndex (step: MusicGuideStep): number {
  return MUSIC_GUIDE_STEPS.indexOf(step)
}

export function canAdvanceMusicGuideStep (
  step: MusicGuideStep,
  brief: MusicGuideBrief
): boolean {
  switch (step) {
    case 'purpose':
      if (brief.purpose === 'other') return brief.purposeOther.trim().length >= 3
      return Boolean(brief.purpose)
    case 'length':
      return Boolean(brief.length)
    case 'vocals':
      if (brief.vocals === 'own_lyrics') return brief.ownLyrics.trim().length >= 8
      return Boolean(brief.vocals)
    case 'mood':
      return brief.mood.trim().length >= 3
    case 'save':
      if (!brief.saveToProject) return true
      return Boolean(brief.projectId.trim())
    case 'review':
      return true
    default:
      return false
  }
}
