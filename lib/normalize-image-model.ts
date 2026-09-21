import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_MODEL_FALLBACKS,
  IMAGE_MODEL_BADGE_OVERRIDES,
  IMAGE_MODEL_LOW_COST_USD,
  PREFERRED_IMAGE_ASPECT_RATIO
} from '~/lib/image-generation-defaults'
import type {
  ImageModel,
  ImageModelBadge,
  ImageModelParamSpec,
  ImageModelPricing
} from '~/types/image-generation'

export type RawOpenRouterImageModel = {
  id?: string
  name?: string
  description?: string
  created?: number
  architecture?: {
    input_modalities?: unknown
    output_modalities?: unknown
    modality?: unknown
  }
  supported_parameters?: unknown
  pricing?: unknown
  endpoints?: unknown
  supports_streaming?: boolean
}

function providerFromId (id: string): string {
  const slash = id.indexOf('/')
  if (slash <= 0) return ''
  const raw = id.slice(0, slash)
  return raw
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function asStringArray (raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseParamSpec (raw: unknown): ImageModelParamSpec {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { type: 'unknown', raw }
  }
  const obj = raw as Record<string, unknown>
  const type = typeof obj.type === 'string' ? obj.type.toLowerCase() : ''
  if (type === 'enum' || Array.isArray(obj.values)) {
    return { type: 'enum', values: asStringArray(obj.values) }
  }
  if (type === 'integer' || type === 'int') {
    return {
      type: 'integer',
      min: typeof obj.min === 'number' ? obj.min : undefined,
      max: typeof obj.max === 'number' ? obj.max : undefined
    }
  }
  if (type === 'number' || type === 'float') {
    return {
      type: 'number',
      min: typeof obj.min === 'number' ? obj.min : undefined,
      max: typeof obj.max === 'number' ? obj.max : undefined
    }
  }
  if (type === 'boolean' || type === 'bool') {
    return { type: 'boolean' }
  }
  if (type === 'string') {
    return { type: 'string' }
  }
  if (Array.isArray(obj)) {
    return { type: 'enum', values: asStringArray(obj) }
  }
  return { type: 'unknown', raw }
}

function parseSupportedParameters (raw: unknown): Record<string, ImageModelParamSpec> {
  if (!raw) return {}
  if (Array.isArray(raw)) {
    const out: Record<string, ImageModelParamSpec> = {}
    for (const key of asStringArray(raw)) {
      out[key] = { type: 'unknown' }
    }
    return out
  }
  if (typeof raw !== 'object') return {}
  const out: Record<string, ImageModelParamSpec> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.trim()) continue
    out[key.trim()] = parseParamSpec(value)
  }
  return out
}

function enumValues (
  params: Record<string, ImageModelParamSpec>,
  ...keys: string[]
): string[] {
  for (const key of keys) {
    const spec = params[key]
    if (spec?.type === 'enum' && spec.values.length) return [...spec.values]
  }
  return []
}

function maxFromIntegerParam (
  params: Record<string, ImageModelParamSpec>,
  key: string,
  fallback: number
): number {
  const spec = params[key]
  if (spec?.type === 'integer' && typeof spec.max === 'number' && spec.max >= 1) {
    return Math.min(10, Math.floor(spec.max))
  }
  return fallback
}

function parsePricing (raw: unknown): ImageModelPricing | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
    return null
  }
  const image = num(obj.image ?? obj.per_image ?? obj.image_generation)
  const prompt = num(obj.prompt ?? obj.input)
  const completion = num(obj.completion ?? obj.output)
  if (image == null && prompt == null && completion == null) {
    return { image: null, prompt: null, completion: null, currency: 'USD', raw: obj }
  }
  return { image, prompt, completion, currency: 'USD', raw: obj }
}

function modalitiesInclude (mods: unknown, needle: string): boolean {
  return asStringArray(mods)
    .map((m) => m.toLowerCase())
    .includes(needle.toLowerCase())
}

function paramKeysInclude (keys: string[], ...needles: string[]): boolean {
  const lower = keys.map((k) => k.toLowerCase())
  return needles.some((n) => lower.includes(n.toLowerCase()))
}

/**
 * Normalize a raw OpenRouter `/api/v1/images/models` row into a stable ImageModel.
 */
export function normalizeImageModel (raw: RawOpenRouterImageModel): ImageModel | null {
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!id) return null

  const supportedParameters = parseSupportedParameters(raw.supported_parameters)
  const supportedParameterKeys = Object.keys(supportedParameters)
  const inputMods = raw.architecture?.input_modalities
  const supportsReferences =
    modalitiesInclude(inputMods, 'image') ||
    paramKeysInclude(supportedParameterKeys, 'input_references', 'input_reference')

  // Editing is only claimed when reference/input image params exist (img2img / edit path).
  const supportsEditing = supportsReferences

  const aspectRatios = enumValues(
    supportedParameters,
    'aspect_ratio',
    'aspectRatio',
    'aspect-ratio'
  )
  const resolutions = enumValues(
    supportedParameters,
    'resolution',
    'size',
    'quality'
  )

  const maxImages = paramKeysInclude(supportedParameterKeys, 'n')
    ? maxFromIntegerParam(supportedParameters, 'n', 4)
    : 1

  const pricing = parsePricing(raw.pricing)
  const name =
    (typeof raw.name === 'string' && raw.name.trim()) || id
  const description =
    typeof raw.description === 'string' ? raw.description.trim().slice(0, 400) : undefined
  const provider = providerFromId(id)

  const badges = buildBadges({
    id,
    pricing,
    supportsReferences,
    supportsEditing
  })

  return {
    id,
    name,
    provider,
    description: description || undefined,
    pricing,
    supportedParameters,
    aspectRatios,
    resolutions,
    maxImages,
    supportsReferences,
    supportsEditing,
    badges,
    supportedParameterKeys
  }
}

function buildBadges (opts: {
  id: string
  pricing: ImageModelPricing | null
  supportsReferences: boolean
  supportsEditing: boolean
}): ImageModelBadge[] {
  const out = new Set<ImageModelBadge>()
  const overrides = IMAGE_MODEL_BADGE_OVERRIDES[opts.id]
  if (overrides) {
    for (const b of overrides) out.add(b)
  }
  if (opts.supportsReferences) out.add('REFERENCE IMAGE')
  if (opts.supportsEditing) out.add('EDITING')
  const imagePrice = opts.pricing?.image
  if (typeof imagePrice === 'number' && imagePrice >= 0 && imagePrice <= IMAGE_MODEL_LOW_COST_USD) {
    out.add('LOW COST')
  }
  return [...out]
}

export function pickDefaultImageModelId (
  models: Array<{ id: string }>,
  preferred?: string | null
): string {
  const ids = new Set(models.map((m) => m.id))
  const preferredId = (preferred || '').trim()
  if (preferredId && ids.has(preferredId)) return preferredId
  for (const id of DEFAULT_IMAGE_MODEL_FALLBACKS) {
    if (ids.has(id)) return id
  }
  return models[0]?.id || DEFAULT_IMAGE_MODEL
}

export function pickDefaultAspectRatio (supported: string[]): string {
  if (!supported.length) return PREFERRED_IMAGE_ASPECT_RATIO
  if (supported.includes(PREFERRED_IMAGE_ASPECT_RATIO)) return PREFERRED_IMAGE_ASPECT_RATIO
  if (supported.includes('1:1')) return '1:1'
  return supported[0]!
}

export function formatImageModelPrice (model: ImageModel): string | null {
  const image = model.pricing?.image
  if (typeof image === 'number' && Number.isFinite(image)) {
    if (image === 0) return 'Free'
    if (image < 0.01) return `~$${image.toFixed(4)}/img`
    return `~$${image.toFixed(3)}/img`
  }
  const prompt = model.pricing?.prompt
  if (typeof prompt === 'number' && Number.isFinite(prompt) && prompt > 0) {
    return `~$${prompt < 0.01 ? prompt.toFixed(4) : prompt.toFixed(3)}`
  }
  return null
}

/**
 * Build an OpenRouter Images API body using only parameters the model supports.
 */
export function buildOpenRouterImageRequest (options: {
  model: ImageModel
  prompt: string
  aspectRatio?: string | null
  resolution?: string | null
  n?: number | null
  inputReferences?: Array<{ type: 'image_url'; image_url: { url: string } }>
  advanced?: {
    seed?: number | null
    guidance?: number | null
    strength?: number | null
    style?: string | null
    negativePrompt?: string | null
    background?: string | null
    outputFormat?: string | null
  }
}): Record<string, unknown> {
  const keys = new Set(
    options.model.supportedParameterKeys.map((k) => k.toLowerCase())
  )
  const has = (...names: string[]) => names.some((n) => keys.has(n.toLowerCase()))

  const body: Record<string, unknown> = {
    model: options.model.id,
    prompt: options.prompt
  }

  const aspect = (options.aspectRatio || '').trim()
  if (aspect && has('aspect_ratio', 'aspectRatio')) {
    if (
      !options.model.aspectRatios.length ||
      options.model.aspectRatios.includes(aspect)
    ) {
      body.aspect_ratio = aspect
    }
  }

  const resolution = (options.resolution || '').trim()
  if (resolution && has('resolution', 'size', 'quality')) {
    if (has('resolution')) {
      if (!options.model.resolutions.length || options.model.resolutions.includes(resolution)) {
        body.resolution = resolution
      }
    } else if (has('size')) {
      body.size = resolution
    } else if (has('quality')) {
      body.quality = resolution
    }
  }

  const n = typeof options.n === 'number' ? Math.floor(options.n) : 1
  if (has('n') && n > 1) {
    const max = options.model.maxImages || 1
    body.n = Math.max(1, Math.min(max, n))
  }

  if (
    options.inputReferences?.length &&
    options.model.supportsReferences &&
    has('input_references', 'input_reference')
  ) {
    body.input_references = options.inputReferences.slice(0, 16)
  }

  const adv = options.advanced
  if (adv) {
    if (typeof adv.seed === 'number' && Number.isFinite(adv.seed) && has('seed')) {
      body.seed = Math.floor(adv.seed)
    }
    if (typeof adv.guidance === 'number' && Number.isFinite(adv.guidance) && has('guidance', 'guidance_scale')) {
      body[has('guidance') ? 'guidance' : 'guidance_scale'] = adv.guidance
    }
    if (typeof adv.strength === 'number' && Number.isFinite(adv.strength) && has('strength')) {
      body.strength = adv.strength
    }
    if (adv.style?.trim() && has('style')) {
      body.style = adv.style.trim()
    }
    if (adv.negativePrompt?.trim() && has('negative_prompt', 'negativePrompt')) {
      body.negative_prompt = adv.negativePrompt.trim()
    }
    if (adv.background?.trim() && has('background')) {
      body.background = adv.background.trim()
    }
    if (adv.outputFormat?.trim() && has('output_format', 'outputFormat')) {
      body.output_format = adv.outputFormat.trim()
    }
  }

  return body
}
