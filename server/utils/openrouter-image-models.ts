import { DEFAULT_IMAGE_MODEL_ID } from '~/lib/character-creator-models'

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
  /** Google image models branded “Nano Banana” on OpenRouter. */
  'nano-banana': 'google/gemini-2.5-flash-image',
  'nano-banana-2': 'google/gemini-3.1-flash-image-preview',
  'nano-banana-pro': 'google/gemini-3-pro-image-preview',
  'gemini-pro-image': 'google/gemini-3-pro-image-preview',
  'gpt-5-image': 'openai/gpt-5-image',
  'gpt-5-image-mini': 'openai/gpt-5-image-mini',
  /** Character Creator labels map to distinct image-capable models (same API). */
  // Keep legacy UI id `dalle-3`, but route to the more reliable OpenAI image mini model.
  'dalle-3': 'openai/gpt-5-image-mini',
  'sdxl-stacy': 'black-forest-labs/flux.2-pro',
  'sdxl-jace': 'black-forest-labs/flux.2-max',
  'deepfloyd': 'black-forest-labs/flux.2-flex',
  'anything-anime': 'google/gemini-2.5-flash-image',
  playground: 'google/gemini-3-pro-image-preview',
  bluewillow: 'openai/gpt-5-image-mini'
}

export function resolveOpenRouterImageSlug (modelId: string): string {
  return OPENROUTER_IMAGE_MODEL_SLUGS[modelId] ?? OPENROUTER_IMAGE_MODEL_SLUGS[DEFAULT_IMAGE_MODEL_ID]
}

/** Gemini image models on OpenRouter require text + image output modalities. */
export function openRouterImageModalities (openRouterSlug: string): Array<'image' | 'text'> {
  if (openRouterSlug.startsWith('google/gemini')) {
    return ['image', 'text']
  }
  return ['image']
}
