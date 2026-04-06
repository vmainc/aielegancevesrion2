/**
 * Internal image route keys → OpenRouter model IDs (chat/completions + modalities: image).
 * @see https://openrouter.ai/collections/image-models
 */
export const OPENROUTER_IMAGE_MODEL_SLUGS: Record<string, string> = {
  'flux-klein': 'black-forest-labs/flux.2-klein-4b',
  'flux-pro': 'black-forest-labs/flux.2-pro',
  'flux-max': 'black-forest-labs/flux.2-max',
  'flux-flex': 'black-forest-labs/flux.2-flex',
  'gemini-flash': 'google/gemini-2.5-flash-image',
  'gemini-pro-image': 'google/gemini-3-pro-image-preview',
  'gpt-5-image': 'openai/gpt-5-image',
  'gpt-5-image-mini': 'openai/gpt-5-image-mini',
  /** Character Creator labels map to distinct image-capable models (same API). */
  'dalle-3': 'openai/gpt-5-image',
  'sdxl-stacy': 'black-forest-labs/flux.2-pro',
  'sdxl-jace': 'black-forest-labs/flux.2-max',
  'deepfloyd': 'black-forest-labs/flux.2-flex',
  'anything-anime': 'google/gemini-2.5-flash-image',
  playground: 'google/gemini-3-pro-image-preview',
  bluewillow: 'openai/gpt-5-image-mini'
}

export function resolveOpenRouterImageSlug (modelId: string): string {
  return OPENROUTER_IMAGE_MODEL_SLUGS[modelId] ?? OPENROUTER_IMAGE_MODEL_SLUGS['flux-klein']
}
