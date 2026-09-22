import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'
import { getVoiceoverModel } from '~/lib/voiceover-generation-models'

function orOpenRouterHeaders (apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    Accept: 'audio/mpeg, application/json'
  }
  if (process.env.OPENROUTER_REFERER) headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE
  if (!headers['HTTP-Referer']) headers['HTTP-Referer'] = 'https://aifilmstud.io'
  if (!headers['X-Title']) headers['X-Title'] = 'AI Film Studio Voiceover'
  return headers
}

function providerSlugFromModelId (modelId: string): string {
  const slash = modelId.indexOf('/')
  return slash > 0 ? modelId.slice(0, slash) : modelId
}

/**
 * Synthesize spoken voiceover via OpenRouter `/api/v1/audio/speech`.
 * `script` is spoken verbatim; `deliveryNotes` are style instructions only (never sung lyrics).
 */
export async function openRouterGenerateVoiceover (options: {
  script: string
  model: string
  voice: string
  apiKey: string
  deliveryNotes?: string
  speed?: number | null
}): Promise<{ buffer: Buffer }> {
  const input = options.script.trim().slice(0, 12_000)
  if (!input) throw new Error('Script is required')
  const model = options.model.trim()
  if (!model) throw new Error('Model is required')
  const voice = options.voice.trim()
  if (!voice) throw new Error('Voice is required')

  const meta = getVoiceoverModel(model)
  const delivery = (options.deliveryNotes || '').trim().slice(0, 2000)
  const speed =
    typeof options.speed === 'number' && Number.isFinite(options.speed)
      ? Math.min(2, Math.max(0.5, options.speed))
      : null

  const body: Record<string, unknown> = {
    model,
    input,
    voice,
    response_format: 'mp3'
  }

  if (speed != null && (meta?.supportsSpeed || model.includes('mai-voice') || model.includes('gpt-4o'))) {
    body.speed = speed
  }

  if (delivery) {
    const slug = providerSlugFromModelId(model)
    const providerOptions: Record<string, Record<string, unknown>> = {}
    if (slug === 'openai' || model.includes('gpt-4o')) {
      providerOptions.openai = { instructions: delivery }
    } else if (slug === 'microsoft' || model.includes('mai-voice')) {
      providerOptions.azure = { style: 'default', styledegree: 1 }
      // Azure styles are discrete; pass freeform as a soft instruction via style when short.
      if (delivery.length <= 40) {
        providerOptions.azure = { style: delivery.replace(/\s+/g, ' ').slice(0, 40), styledegree: 1.1 }
      }
    } else if (slug === 'google') {
      providerOptions.google = { instructions: delivery }
    } else if (slug === 'x-ai') {
      providerOptions['x-ai'] = { instructions: delivery }
    }
    if (Object.keys(providerOptions).length) {
      body.provider = { options: providerOptions }
    }
  }

  const res = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/audio/speech',
    {
      method: 'POST',
      headers: orOpenRouterHeaders(options.apiKey),
      body: JSON.stringify(body)
    },
    120_000
  )

  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    let message = `Voiceover generation failed (${res.status})`
    try {
      const j = JSON.parse(errText) as { error?: { message?: string }; message?: string }
      message = j.error?.message || j.message || message
    } catch {
      if (errText.trim()) message = errText.trim().slice(0, 400)
    }
    throw new Error(message)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  if (!buf.length) {
    throw new Error('TTS returned empty audio')
  }
  if (contentType.includes('json')) {
    const text = buf.toString('utf8')
    throw new Error(text.slice(0, 400) || 'TTS returned JSON instead of audio')
  }
  return { buffer: buf }
}
