/** Normalized OpenRouter image-generation model for AI Film Studio. */

export type ImageModelParamSpec =
  | { type: 'enum'; values: string[] }
  | { type: 'integer'; min?: number; max?: number }
  | { type: 'number'; min?: number; max?: number }
  | { type: 'boolean' }
  | { type: 'string' }
  | { type: 'unknown'; raw?: unknown }

export type ImageModelPricing = {
  /** USD per image when reported. */
  image?: number | null
  prompt?: number | null
  completion?: number | null
  currency: 'USD'
  raw?: Record<string, unknown> | null
}

export type ImageModelBadge = 'FAST' | 'QUALITY' | 'EDITING' | 'REFERENCE IMAGE' | 'LOW COST'

export type ImageModel = {
  id: string
  name: string
  provider: string
  description?: string
  pricing: ImageModelPricing | null
  supportedParameters: Record<string, ImageModelParamSpec>
  aspectRatios: string[]
  resolutions: string[]
  maxImages: number
  supportsReferences: boolean
  supportsEditing: boolean
  /** Badges derived only from metadata or explicit config — never invented. */
  badges: ImageModelBadge[]
  /** Raw OpenRouter parameter keys (for request construction). */
  supportedParameterKeys: string[]
}

export type FilmControls = {
  shotSize?: string | null
  cameraAngle?: string | null
  lens?: string | null
  lighting?: string | null
  style?: string | null
}

export type ImageGenerationCategory =
  | 'characters'
  | 'locations'
  | 'storyboards'
  | 'props'
  | 'concept_art'
  | 'other'

export type ImageGenerationStatus = 'queued' | 'generating' | 'complete' | 'failed'

export type ImageGenerationAdvancedSettings = {
  seed?: number | null
  guidance?: number | null
  strength?: number | null
  style?: string | null
  negativePrompt?: string | null
  background?: string | null
  outputFormat?: string | null
}

export type ImageGenerationRecord = {
  id: string
  userId: string
  projectId: string | null
  projectName?: string | null
  prompt: string
  finalPrompt: string
  model: string
  provider: string
  status: ImageGenerationStatus
  aspectRatio: string | null
  resolution: string | null
  imageCount: number
  category: ImageGenerationCategory
  generationSettings: Record<string, unknown> | null
  filmControls: FilmControls | null
  referenceImageCount: number
  cost: number | null
  currency: string | null
  usage: Record<string, unknown> | null
  errorMessage: string | null
  durationMs: number | null
  favorite: boolean
  /** Public app URLs for output images (auth required). */
  imageUrls: string[]
  /** Linked project_assets ids when persisted as library assets. */
  assetIds: string[]
  created: string
  updated: string
}
