/** Character Creator — selectable image models (UI labels). Routing: `id` → `server/utils/openrouter-image-models`. */
export const CHARACTER_CREATOR_IMAGE_MODELS = [
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
