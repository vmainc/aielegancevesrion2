import type { ImageModelBadge } from '~/types/image-generation'
import type { FilmControls, ImageGenerationCategory } from '~/types/image-generation'

/**
 * Default OpenRouter image model for Generate → Images.
 * Prefer full provider/model slugs (Images API), not Character Creator UI keys.
 * Configure via OPENROUTER_DEFAULT_IMAGE_MODEL / NUXT_OPENROUTER_DEFAULT_IMAGE_MODEL.
 */
export const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image'

/** Fallback order when the configured default is missing from the live catalog. */
export const DEFAULT_IMAGE_MODEL_FALLBACKS = [
  DEFAULT_IMAGE_MODEL,
  'google/gemini-3.1-flash-image-preview',
  'black-forest-labs/flux.2-klein-4b',
  'black-forest-labs/flux.2-pro',
  'openai/gpt-5-image-mini',
  'openai/gpt-5-image'
] as const

/** Preferred filmmaking aspect ratio when the model supports it. */
export const PREFERRED_IMAGE_ASPECT_RATIO = '16:9'

export const IMAGE_ASPECT_RATIO_PRESETS: Array<{ value: string; label: string }> = [
  { value: '16:9', label: '16:9 — Widescreen' },
  { value: '9:16', label: '9:16 — Vertical' },
  { value: '1:1', label: '1:1 — Square' },
  { value: '4:3', label: '4:3 — Classic' },
  { value: '3:2', label: '3:2 — Photo' },
  { value: '2.39:1', label: '2.39:1 — Cinematic' },
  { value: '21:9', label: '21:9 — Ultrawide' }
]

/** Explicit badge hints only — never invent capabilities not listed here or in OpenRouter metadata. */
export const IMAGE_MODEL_BADGE_OVERRIDES: Record<string, ImageModelBadge[]> = {
  'google/gemini-2.5-flash-image': ['FAST'],
  'google/gemini-3.1-flash-image-preview': ['FAST'],
  'google/gemini-3-pro-image-preview': ['QUALITY'],
  'black-forest-labs/flux.2-klein-4b': ['FAST', 'LOW COST'],
  'black-forest-labs/flux.2-pro': ['QUALITY'],
  'black-forest-labs/flux.2-max': ['QUALITY'],
  'openai/gpt-5-image-mini': ['FAST', 'LOW COST'],
  'openai/gpt-5-image': ['QUALITY']
}

/** USD/image at or below this (when pricing is known) earns LOW COST from metadata. */
export const IMAGE_MODEL_LOW_COST_USD = 0.02

export const IMAGE_GENERATION_CATEGORY_IDS = [
  'characters',
  'locations',
  'storyboards',
  'props',
  'concept_art',
  'logos',
  'titles',
  'graphics',
  'other'
] as const satisfies readonly ImageGenerationCategory[]

export const IMAGE_GENERATION_CATEGORIES: Array<{
  id: ImageGenerationCategory | 'all'
  label: string
}> = [
  { id: 'all', label: 'All' },
  { id: 'characters', label: 'Characters' },
  { id: 'locations', label: 'Locations' },
  { id: 'storyboards', label: 'Storyboards' },
  { id: 'props', label: 'Props' },
  { id: 'concept_art', label: 'Concept Art' },
  { id: 'logos', label: 'Logos' },
  { id: 'titles', label: 'Titles' },
  { id: 'graphics', label: 'Graphics' },
  { id: 'other', label: 'Other' }
]

export const FILM_CONTROL_SHOT_SIZES = [
  'Extreme Wide',
  'Wide',
  'Medium Wide',
  'Medium',
  'Medium Close-Up',
  'Close-Up',
  'Extreme Close-Up'
] as const

export const FILM_CONTROL_CAMERA_ANGLES = [
  'Eye Level',
  'Low Angle',
  'High Angle',
  'Overhead',
  'Dutch Angle',
  'POV',
  'Over-the-Shoulder'
] as const

export const FILM_CONTROL_LENSES = ['14mm', '24mm', '35mm', '50mm', '85mm', '135mm'] as const

export const FILM_CONTROL_LIGHTING = [
  'Natural',
  'Soft',
  'Hard',
  'High Key',
  'Low Key',
  'Backlit',
  'Practical',
  'Neon',
  'Golden Hour',
  'Moonlight'
] as const

export const FILM_CONTROL_STYLES = [
  'Cinematic',
  'Photorealistic',
  'Storyboard',
  'Concept Art',
  'Film Still',
  'Documentary',
  'Vintage Film',
  'Black & White'
] as const

export const EMPTY_FILM_CONTROLS: FilmControls = {
  shotSize: null,
  cameraAngle: null,
  lens: null,
  lighting: null,
  style: null
}

/** Metadata.source for project_assets created from Generate → Images. */
export const IMAGE_GENERATION_ASSET_SOURCE = 'image_generation'

export const IMAGE_GENERATION_MAX_REFERENCE_BYTES = 8 * 1024 * 1024
export const IMAGE_GENERATION_MAX_REFERENCES = 8
export const IMAGE_GENERATION_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
])
