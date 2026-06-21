/** OpenRouter Lyria music models (Google). */
export const LYRIA_CLIP_MODEL_ID = 'google/lyria-3-clip-preview'
export const LYRIA_PRO_MODEL_ID = 'google/lyria-3-pro-preview'

export type MusicGenerationModelId =
  | typeof LYRIA_CLIP_MODEL_ID
  | typeof LYRIA_PRO_MODEL_ID

export type MusicModelOption = {
  id: MusicGenerationModelId
  label: string
  description: string
  /** Approximate output length hint for UI. */
  durationHint: string
  priceHint: string
}

export const MUSIC_GENERATION_MODELS: MusicModelOption[] = [
  {
    id: LYRIA_CLIP_MODEL_ID,
    label: 'Lyria 3 Clip',
    description: '~30 second loops and score beds — ideal for scene underscore and themes.',
    durationHint: '~30 seconds',
    priceHint: '~$0.04 per clip'
  },
  {
    id: LYRIA_PRO_MODEL_ID,
    label: 'Lyria 3 Pro',
    description: 'Longer structured pieces (verses, bridges) — main themes and end credits.',
    durationHint: 'Up to ~3 minutes',
    priceHint: '~$0.08 per song'
  }
]

export const DEFAULT_MUSIC_MODEL_ID: MusicGenerationModelId = LYRIA_CLIP_MODEL_ID

export function isMusicGenerationModelId (id: string): id is MusicGenerationModelId {
  return id === LYRIA_CLIP_MODEL_ID || id === LYRIA_PRO_MODEL_ID
}
