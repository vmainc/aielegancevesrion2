/** Default when the user does not pick a model (OpenRouter Nano Banana). */
export const DEFAULT_IMAGE_MODEL_ID = 'nano-banana' as const

/** Server retry order after the user’s chosen model fails. */
export const IMAGE_MODEL_FALLBACK_IDS = [
  DEFAULT_IMAGE_MODEL_ID,
  'nano-banana-2',
  'flux-klein',
  'flux-pro',
  'gemini-flash'
] as const

/** Character Creator — selectable image models (UI labels). Routing: `id` → `server/utils/openrouter-image-models`. */
export const CHARACTER_CREATOR_IMAGE_MODELS = [
  { id: 'nano-banana', label: 'Nano Banana (Gemini 2.5 Flash Image)' },
  { id: 'nano-banana-2', label: 'Nano Banana 2 (Gemini 3.1 Flash Image)' },
  { id: 'flux-klein', label: 'Flux Klein (flux.2-klein-4b)' },
  { id: 'dalle-3', label: 'OpenAI Image (gpt-5-image-mini)' },
  { id: 'sdxl-stacy', label: 'SDXL (Stacy)' },
  { id: 'sdxl-jace', label: 'SDXL (Jace)' },
  { id: 'deepfloyd', label: 'DeepFloyd' },
  { id: 'anything-anime', label: 'Anything (Anime)' },
  { id: 'playground', label: 'Playground' },
  { id: 'bluewillow', label: 'BlueWillow' }
] as const

export type CharacterCreatorModelId = (typeof CHARACTER_CREATOR_IMAGE_MODELS)[number]['id']

export const CHARACTER_CREATOR_MODEL_IDS = new Set<string>(
  CHARACTER_CREATOR_IMAGE_MODELS.map(m => m.id)
)
