import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

/** Matches OpenRouter’s directory when the API is unavailable or key is missing. */
const FALLBACK_VIDEO_MODELS = [
  {
    id: 'alibaba/wan-2.6',
    name: 'Alibaba: Wan 2.6',
    description: 'Experimental video generation (API-only, alpha).',
    provider: 'Alibaba',
  },
  {
    id: 'bytedance/seedance-1.5-pro',
    name: 'ByteDance: Seedance 1.5 Pro',
    description: 'Experimental video generation (API-only, alpha).',
    provider: 'ByteDance',
  },
  {
    id: 'openai/sora-2-pro',
    name: 'OpenAI: Sora 2 Pro',
    description: 'Experimental video generation (API-only, alpha).',
    provider: 'OpenAI',
  },
  {
    id: 'google/veo-3.1',
    name: 'Google: Veo 3.1',
    description: 'Experimental video generation (API-only, alpha).',
    provider: 'Google',
  },
]

type VideoModelRow = {
  id: string
  name: string
  description?: string
  provider?: string
  outputModalities?: string[]
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)

  const headers: Record<string, string> = {
    Accept: 'application/json',
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
      models: FALLBACK_VIDEO_MODELS,
      notice: 'Set OPENROUTER_API_KEY in your environment to load the live model list from OpenRouter.',
    }
  }

  const url = new URL('https://openrouter.ai/api/v1/models')
  url.searchParams.set('output_modalities', 'video')

  const res = await fetch(url.toString(), { headers })
  const rawText = await res.text()

  if (!res.ok) {
    return {
      source: 'fallback' as const,
      models: FALLBACK_VIDEO_MODELS,
      notice: `OpenRouter returned HTTP ${res.status}. Showing reference models.`,
      error: rawText.slice(0, 200),
    }
  }

  let json: { data?: unknown[] }
  try {
    json = JSON.parse(rawText) as { data?: unknown[] }
  } catch {
    return {
      source: 'fallback' as const,
      models: FALLBACK_VIDEO_MODELS,
      notice: 'Could not parse OpenRouter response. Showing reference models.',
    }
  }

  const rows: VideoModelRow[] = []
  for (const m of json.data || []) {
    if (!m || typeof m !== 'object') continue
    const row = m as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const name = typeof row.name === 'string' ? row.name : id
    if (!id) continue

    const desc = typeof row.description === 'string' ? row.description : ''
    const arch = row.architecture as Record<string, unknown> | undefined
    const outMods = Array.isArray(arch?.output_modalities)
      ? (arch!.output_modalities as string[]).filter((x) => typeof x === 'string')
      : undefined

    const providerFromId = id.includes('/') ? id.split('/')[0] : undefined

    rows.push({
      id,
      name,
      description: desc,
      provider: providerFromId,
      outputModalities: outMods,
    })
  }

  rows.sort((a, b) => a.name.localeCompare(b.name))

  if (rows.length === 0) {
    return {
      source: 'fallback' as const,
      models: FALLBACK_VIDEO_MODELS,
      notice: 'No video models returned from OpenRouter. Showing reference models.',
    }
  }

  return {
    source: 'api' as const,
    models: rows,
  }
})
