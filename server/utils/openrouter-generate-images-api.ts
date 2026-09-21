import { createError } from 'h3'
import { buildOpenRouterImageRequest } from '~/lib/normalize-image-model'
import type { ImageModel } from '~/types/image-generation'
import type { ImageGenerationAdvancedSettings } from '~/types/image-generation'

export type DecodedGeneratedImage = {
  mime: string
  data: Buffer
  /** Original remote URL when OpenRouter returned a URL instead of base64. */
  sourceUrl?: string
}

export type OpenRouterImagesApiResult = {
  images: DecodedGeneratedImage[]
  model: string
  usage: Record<string, unknown> | null
  costUsd: number | null
  rawKeys: string[]
}

function openRouterHeaders (apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey.trim()}`
  }
  if (process.env.OPENROUTER_REFERER) headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE
  if (!headers['X-Title']) headers['X-Title'] = 'AI Film Studio Images'
  return headers
}

function mapOpenRouterImageError (status: number, message: string): { statusCode: number; message: string } {
  const lower = message.toLowerCase()
  if (status === 401) {
    return {
      statusCode: 401,
      message: 'Image provider authentication failed. Check OPENROUTER_API_KEY and try again.'
    }
  }
  if (status === 402 || lower.includes('insufficient') || lower.includes('credits')) {
    return {
      statusCode: 402,
      message: 'Not enough OpenRouter credits to generate this image. Add credits or try a lower-cost model.'
    }
  }
  if (status === 404 || lower.includes('no endpoints') || lower.includes('model not found')) {
    return {
      statusCode: 404,
      message: 'That model is temporarily unavailable. Try another image model.'
    }
  }
  if (status === 429 || lower.includes('rate limit')) {
    return {
      statusCode: 429,
      message: 'Image generation is rate-limited right now. Wait a moment and try again.'
    }
  }
  if (
    lower.includes('moderation') ||
    lower.includes('content policy') ||
    lower.includes('safety') ||
    lower.includes('blocked')
  ) {
    return {
      statusCode: 400,
      message: 'That prompt was blocked by content moderation. Adjust the description and try again.'
    }
  }
  if (lower.includes('unsupported') || lower.includes('invalid parameter')) {
    return {
      statusCode: 400,
      message: 'One of the selected options is not supported by this model. Change settings and try again.'
    }
  }
  if (status === 408 || status === 504 || lower.includes('timeout') || lower.includes('timed out')) {
    return {
      statusCode: 504,
      message: 'Image generation timed out. Try again or switch to a faster model.'
    }
  }
  if (status === 503 || (lower.includes('provider') && lower.includes('unavailable'))) {
    return {
      statusCode: 503,
      message: 'That model is temporarily unavailable. Try another image model.'
    }
  }
  return {
    statusCode: status >= 400 && status < 600 ? status : 502,
    message: message.slice(0, 280) || 'Image generation failed.'
  }
}

function parseDataUrl (dataUrl: string): DecodedGeneratedImage | null {
  const raw = dataUrl.trim()
  const comma = raw.indexOf(',')
  if (!raw.startsWith('data:') || comma < 0) return null
  const meta = raw.slice(0, comma)
  const mime = meta.match(/^data:([^;]+)/i)?.[1] || 'image/png'
  try {
    const data = Buffer.from(raw.slice(comma + 1), 'base64')
    if (!data.length) return null
    return { mime, data }
  } catch {
    return null
  }
}

function decodeB64 (b64: string, mimeHint?: string): DecodedGeneratedImage | null {
  const cleaned = b64.replace(/\s+/g, '')
  if (!cleaned) return null
  try {
    const data = Buffer.from(cleaned, 'base64')
    if (!data.length) return null
    return { mime: mimeHint || 'image/png', data }
  } catch {
    return null
  }
}

function extractUsageCost (usage: Record<string, unknown> | null): number | null {
  if (!usage) return null
  const candidates = [usage.cost, usage.total_cost, usage.totalCost, (usage as { cost?: { total?: unknown } }).cost]
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c
    if (c && typeof c === 'object' && typeof (c as { total?: unknown }).total === 'number') {
      return (c as { total: number }).total
    }
  }
  return null
}

/**
 * Decode OpenRouter Images API `data[]` (and common alternate shapes) into buffers.
 * Does not assume only data[0] exists.
 */
export function decodeOpenRouterImageResponse (payload: unknown): {
  images: DecodedGeneratedImage[]
  usage: Record<string, unknown> | null
  costUsd: number | null
} {
  const images: DecodedGeneratedImage[] = []
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const usage =
    root.usage && typeof root.usage === 'object' && !Array.isArray(root.usage)
      ? (root.usage as Record<string, unknown>)
      : null

  const rows: unknown[] = []
  if (Array.isArray(root.data)) rows.push(...root.data)
  if (Array.isArray(root.images)) rows.push(...root.images)

  for (const row of rows) {
    if (typeof row === 'string') {
      if (row.startsWith('data:')) {
        const decoded = parseDataUrl(row)
        if (decoded) images.push(decoded)
      } else if (row.startsWith('http')) {
        images.push({ mime: 'image/png', data: Buffer.alloc(0), sourceUrl: row })
      }
      continue
    }
    if (!row || typeof row !== 'object') continue
    const obj = row as Record<string, unknown>
    const mime =
      (typeof obj.media_type === 'string' && obj.media_type) ||
      (typeof obj.mime_type === 'string' && obj.mime_type) ||
      (typeof obj.mimeType === 'string' && obj.mimeType) ||
      'image/png'

    const b64 =
      (typeof obj.b64_json === 'string' && obj.b64_json) ||
      (typeof obj.b64Json === 'string' && obj.b64Json) ||
      (typeof obj.base64 === 'string' && obj.base64) ||
      ''

    if (b64) {
      const decoded = decodeB64(b64, mime)
      if (decoded) images.push(decoded)
      continue
    }

    let url = ''
    if (typeof obj.url === 'string') {
      url = obj.url
    } else if (obj.image_url && typeof obj.image_url === 'object') {
      const nested = (obj.image_url as { url?: unknown }).url
      if (typeof nested === 'string') url = nested
    }

    if (url.startsWith('data:')) {
      const decoded = parseDataUrl(url)
      if (decoded) images.push(decoded)
    } else if (url.startsWith('http')) {
      images.push({ mime, data: Buffer.alloc(0), sourceUrl: url })
    }
  }

  return { images, usage, costUsd: extractUsageCost(usage) }
}

async function hydrateRemoteImages (
  images: DecodedGeneratedImage[],
  apiKey: string
): Promise<DecodedGeneratedImage[]> {
  const out: DecodedGeneratedImage[] = []
  for (const img of images) {
    if (img.data.length) {
      out.push(img)
      continue
    }
    if (!img.sourceUrl) continue
    try {
      const headers: Record<string, string> = { Accept: 'image/*' }
      try {
        const host = new URL(img.sourceUrl).hostname.toLowerCase()
        if (host === 'openrouter.ai' || host.endsWith('.openrouter.ai')) {
          headers.Authorization = `Bearer ${apiKey.trim()}`
        }
      } catch {
        /* ignore */
      }
      const res = await fetch(img.sourceUrl, { headers })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (!buf.length) continue
      const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || img.mime || 'image/png'
      out.push({ mime, data: buf, sourceUrl: img.sourceUrl })
    } catch {
      /* skip failed download */
    }
  }
  return out
}

export async function generateImagesViaOpenRouterApi (options: {
  apiKey: string
  model: ImageModel
  prompt: string
  aspectRatio?: string | null
  resolution?: string | null
  n?: number | null
  inputReferenceUrls?: string[]
  advanced?: ImageGenerationAdvancedSettings | null
  timeoutMs?: number
}): Promise<OpenRouterImagesApiResult> {
  const inputReferences = (options.inputReferenceUrls || [])
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 16)
    .map((url) => ({ type: 'image_url' as const, image_url: { url } }))

  const body = buildOpenRouterImageRequest({
    model: options.model,
    prompt: options.prompt,
    aspectRatio: options.aspectRatio,
    resolution: options.resolution,
    n: options.n,
    inputReferences: inputReferences.length ? inputReferences : undefined,
    advanced: options.advanced || undefined
  })

  const timeoutMs = options.timeoutMs ?? (options.model.id.startsWith('openai/') ? 120_000 : 90_000)
  console.info('[image-generate] request', {
    model: options.model.id,
    aspectRatio: body.aspect_ratio ?? null,
    resolution: body.resolution ?? body.size ?? body.quality ?? null,
    n: body.n ?? 1,
    hasReferences: Boolean(body.input_references),
    paramKeys: Object.keys(body).filter((k) => k !== 'prompt')
  })

  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: openRouterHeaders(options.apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const mapped = mapOpenRouterImageError(
      msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('aborted') ? 504 : 502,
      msg
    )
    throw createError(mapped)
  }

  const rawText = await res.text()
  let payload: unknown = null
  try {
    payload = rawText ? JSON.parse(rawText) : null
  } catch {
    payload = null
  }

  if (!res.ok) {
    const errObj =
      payload && typeof payload === 'object'
        ? (payload as { error?: { message?: string }; message?: string })
        : null
    const message =
      errObj?.error?.message || errObj?.message || rawText.slice(0, 280) || `OpenRouter error ${res.status}`
    const mapped = mapOpenRouterImageError(res.status, message)
    console.warn('[image-generate] provider error', {
      status: res.status,
      model: options.model.id,
      message: mapped.message
    })
    throw createError(mapped)
  }

  const decoded = decodeOpenRouterImageResponse(payload)
  const images = await hydrateRemoteImages(decoded.images, options.apiKey)
  if (!images.length) {
    console.warn('[image-generate] empty image response', { model: options.model.id })
    throw createError({
      statusCode: 502,
      message: 'No image was returned. Try another model or adjust your prompt.'
    })
  }

  console.info('[image-generate] complete', {
    model: options.model.id,
    imageCount: images.length,
    costUsd: decoded.costUsd
  })

  return {
    images,
    model: options.model.id,
    usage: decoded.usage,
    costUsd: decoded.costUsd,
    rawKeys: Object.keys((payload as Record<string, unknown>) || {})
  }
}
