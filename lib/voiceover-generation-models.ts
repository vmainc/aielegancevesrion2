/** Curated OpenRouter TTS models for Generate → Voiceover. */

export type VoiceoverModelOption = {
  id: string
  name: string
  description: string
  voices: Array<{ id: string; label: string }>
  /** When true, delivery notes are sent as provider instructions (not spoken). */
  supportsInstructions?: boolean
  supportsSpeed?: boolean
  priceHint: string
}

export const DEFAULT_VOICEOVER_MODEL_ID = 'x-ai/grok-voice-tts-1.0'

export const VOICEOVER_GENERATION_MODELS: VoiceoverModelOption[] = [
  {
    id: 'x-ai/grok-voice-tts-1.0',
    name: 'Grok Voice TTS',
    description: 'Clear narration voices — strong default for film voiceover.',
    voices: [
      { id: 'eve', label: 'Eve' },
      { id: 'ara', label: 'Ara' },
      { id: 'rex', label: 'Rex' },
      { id: 'sal', label: 'Sal' },
      { id: 'leo', label: 'Leo' }
    ],
    priceHint: 'Per character'
  },
  {
    id: 'google/gemini-3.1-flash-tts-preview',
    name: 'Gemini 3.1 Flash TTS',
    description: 'Fast Google TTS with a wide voice set.',
    voices: [
      { id: 'Zephyr', label: 'Zephyr' },
      { id: 'Puck', label: 'Puck' },
      { id: 'Charon', label: 'Charon' },
      { id: 'Kore', label: 'Kore' },
      { id: 'Fenrir', label: 'Fenrir' },
      { id: 'Aoede', label: 'Aoede' }
    ],
    priceHint: 'Per character'
  },
  {
    id: 'microsoft/mai-voice-2',
    name: 'MAI Voice 2',
    description: 'Expressive Azure voices; delivery notes map to speaking style when possible.',
    voices: [
      { id: 'en-US-Harper:MAI-Voice-2', label: 'Harper (EN)' },
      { id: 'es-MX-Valeria:MAI-Voice-2', label: 'Valeria (ES)' },
      { id: 'fr-FR-Soleil:MAI-Voice-2', label: 'Soleil (FR)' },
      { id: 'de-DE-Klaus:MAI-Voice-2', label: 'Klaus (DE)' }
    ],
    supportsInstructions: true,
    supportsSpeed: true,
    priceHint: 'Per character'
  },
  {
    id: 'mistralai/voxtral-mini-tts-2603',
    name: 'Voxtral Mini TTS',
    description: 'Emotion-tagged English voices (neutral, warm, intense, etc.).',
    voices: [
      { id: 'en_paul_neutral', label: 'Paul — Neutral' },
      { id: 'en_paul_cheerful', label: 'Paul — Cheerful' },
      { id: 'en_paul_sad', label: 'Paul — Sad' },
      { id: 'en_paul_excited', label: 'Paul — Excited' },
      { id: 'en_paul_confident', label: 'Paul — Confident' },
      { id: 'en_paul_frustrated', label: 'Paul — Frustrated' }
    ],
    priceHint: 'Per character'
  },
  {
    id: 'minimax/speech-2.8-turbo',
    name: 'MiniMax Speech 2.8 Turbo',
    description: 'Narration and character-style English voices.',
    voices: [
      { id: 'English_expressive_narrator', label: 'Expressive narrator' },
      { id: 'English_Trustworth_Man', label: 'Trustworthy man' },
      { id: 'English_Upbeat_Woman', label: 'Upbeat woman' },
      { id: 'English_magnetic_voiced_man', label: 'Magnetic man' },
      { id: 'English_radiant_girl', label: 'Radiant girl' }
    ],
    priceHint: 'Per character'
  }
]

export function getVoiceoverModel (id: string): VoiceoverModelOption | null {
  return VOICEOVER_GENERATION_MODELS.find((m) => m.id === id) || null
}

export function isVoiceoverModelId (id: string): boolean {
  return VOICEOVER_GENERATION_MODELS.some((m) => m.id === id)
}

export function defaultVoiceForModel (modelId: string): string {
  const m = getVoiceoverModel(modelId)
  return m?.voices[0]?.id || 'eve'
}

/** Spoken script only — never include delivery notes here. */
export function buildVoiceoverSpeechInput (script: string): string {
  return (script || '').trim().slice(0, 12_000)
}
