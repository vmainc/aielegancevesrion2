import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import {
  OPENROUTER_IMAGE_MODEL_SLUGS,
  resolveOpenRouterImageSlug
} from '~/server/utils/openrouter-image-models'
import { DEFAULT_IMAGE_MODEL_ID } from '~/lib/character-creator-models'

/** When OpenRouter catalog is unavailable. */
const FALLBACK_IMAGE_MODELS: Array<{ id: string; name: string; description?: string; provider?: string }> = [
  {
    id: 'google/gemini-2.5-flash-image',
    name: 'Google: Gemini 2.5 Flash Image (Nano Banana)',
    description: 'Fast image generation.',
    provider: 'Google'
  },
  {
    id: 'google/gemini-3.1-flash-image-preview',
    name: 'Google: Gemini 3.1 Flash Image (Nano Banana 2)',
    description: 'Preview flash image model.',
    provider: 'Google'
  },
  {
    id: 'google/gemini-3-pro-image-preview',
    name: 'Google: Gemini 3 Pro Image',
    description: 'Higher-quality image preview.',
    provider: 'Google'
  },
  {
    id: 'black-forest-labs/flux.2-klein-4b',
    name: 'Black Forest Labs: FLUX.2 Klein 4B',
    provider: 'Black Forest Labs'
  },
  {
    id: 'black-forest-labs/flux.2-pro',
    name: 'Black Forest Labs: FLUX.2 Pro',
    provider: 'Black Forest Labs'
  },
  {
    id: 'openai/gpt-5-image-mini',
    name: 'OpenAI: GPT-5 Image Mini',
    provider: 'OpenAI'
  },
  {
    id: 'openai/gpt-5-image',
    name: 'OpenAI: GPT-5 Image',
    provider: 'OpenAI'
  }
]

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

function hasImageOutput (row: {
  architecture?: { output_modalities?: unknown; modality?: unknown }
  output_modalities?: unknown
}): boolean {
  const arch = row.architecture
  const fromArch = Array.isArray(arch?.output_modalities) ? arch!.output_modalities : null
  const fromTop = Array.isArray(row.output_modalities) ? row.output_modalities : null
  const mods = (fromArch || fromTop || [])
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.toLowerCase())
  if (mods.includes('image')) return true
  const modality = typeof arch?.modality === 'string' ? arch.modality.toLowerCase() : ''
  return modality.includes('image')
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  const defaultModelId = resolveOpenRouterImageSlug(DEFAULT_IMAGE_MODEL_ID)

  const headers: Record<string, string> = {
    Accept: 'application/json'
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey.trim()}`
  }
  if (process.env.OPENROUTER_REFERER) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  }
  if (process.env.OPENROUTER_TITLE) {
    headers['X-Title'] = process.env.OPENROUTER_TITLE
  }

  if (!apiKey) {
    return {
      source: 'fallback' as const,
      models: FALLBACK_IMAGE_MODELS,
      defaultModelId,
      notice: 'Set OPENROUTER_API_KEY to load the live image model list from OpenRouter.'
    }
  }

  const url = new URL('https://openrouter.ai/api/v1/models')
  url.searchParams.set('output_modalities', 'image')

  const res = await fetch(url.toString(), { headers })
  const rawText = await res.text()
  if (!res.ok) {
    return {
      source: 'fallback' as const,
      models: FALLBACK_IMAGE_MODELS,
      defaultModelId,
      notice: `OpenRouter models API error (${res.status}). Showing fallback list.`
    }
  }

  let payload: {
    data?: Array<{
      id?: string
      name?: string
      description?: string
      architecture?: { output_modalities?: unknown; modality?: unknown }
      output_modalities?: unknown
    }>
  }
  try {
    payload = JSON.parse(rawText) as typeof payload
  } catch {
    return {
      source: 'fallback' as const,
      models: FALLBACK_IMAGE_MODELS,
      defaultModelId,
      notice: 'Could not parse OpenRouter models response. Showing fallback list.'
    }
  }

  const models = (payload.data || [])
    .map((row) => {
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      if (!id || !hasImageOutput(row)) return null
      const name = (typeof row.name === 'string' && row.name.trim()) || id
      const description =
        typeof row.description === 'string' ? row.description.trim().slice(0, 280) : undefined
      return {
        id,
        name,
        description: description || undefined,
        provider: providerFromId(id) || undefined
      }
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Ensure known good defaults appear even if filter quirks exclude them
  const seen = new Set(models.map((m) => m.id))
  for (const slug of Object.values(OPENROUTER_IMAGE_MODEL_SLUGS)) {
    if (seen.has(slug)) continue
    const fb = FALLBACK_IMAGE_MODELS.find((m) => m.id === slug)
    models.push(
      fb || {
        id: slug,
        name: slug,
        provider: providerFromId(slug) || undefined
      }
    )
    seen.add(slug)
  }
  models.sort((a, b) => a.name.localeCompare(b.name))

  return {
    source: 'openrouter' as const,
    models,
    defaultModelId: models.some((m) => m.id === defaultModelId)
      ? defaultModelId
      : models[0]?.id || defaultModelId
  }
})
