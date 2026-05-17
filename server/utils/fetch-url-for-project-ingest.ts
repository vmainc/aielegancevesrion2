import { createError } from 'h3'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'

function openRouterVideoHeaders (apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    Accept: 'video/*,*/*'
  }
  if (process.env.OPENROUTER_REFERER) headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE
  if (!headers['HTTP-Referer']) headers['HTTP-Referer'] = 'https://aielegance.com'
  if (!headers['X-Title']) headers['X-Title'] = 'AI Elegance Video'
  return headers
}

function hostNeedsOpenRouterAuth (urlStr: string): boolean {
  try {
    const h = new URL(urlStr).hostname.toLowerCase()
    return h === 'openrouter.ai' || h.endsWith('.openrouter.ai')
  } catch {
    return false
  }
}

export async function fetchBinaryFromUrlForIngest (
  urlStr: string,
  options: { openRouterApiKey?: string; maxBytes: number; timeoutMs?: number }
): Promise<{ buffer: Buffer; contentType: string; suggestedName: string }> {
  const url = urlStr.trim()
  if (!url || !/^https?:\/\//i.test(url)) {
    throw createError({ statusCode: 400, message: 'A valid http(s) URL is required' })
  }

  const timeoutMs = options.timeoutMs ?? 120_000
  const headers: Record<string, string> = { Accept: 'video/*,*/*' }
  if (hostNeedsOpenRouterAuth(url)) {
    const k = options.openRouterApiKey?.trim()
    if (!k) {
      throw createError({
        statusCode: 500,
        message: 'OPENROUTER_API_KEY is required to download OpenRouter-hosted video files.'
      })
    }
    Object.assign(headers, openRouterVideoHeaders(k))
  }

  const res = await fetchWithTimeout(url, { method: 'GET', headers }, timeoutMs)
  if (!res.ok) {
    throw createError({
      statusCode: 502,
      message: `Could not download video (HTTP ${res.status})`
    })
  }

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > options.maxBytes) {
    throw createError({ statusCode: 413, message: 'Downloaded file exceeds maximum size for library upload' })
  }
  if (buf.length < 64) {
    throw createError({ statusCode: 502, message: 'Downloaded file is too small to be a valid video' })
  }

  const cd = res.headers.get('content-disposition') || ''
  const m = /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(cd)
  let suggestedName = (m?.[1] || '').trim().replace(/["']/g, '')
  if (!suggestedName || !/\.[a-z0-9]{2,5}$/i.test(suggestedName)) {
    suggestedName = `generated_${Date.now()}.mp4`
  }
  const ct = (res.headers.get('content-type') || '').split(';')[0]?.trim() || 'video/mp4'
  return { buffer: buf, contentType: ct, suggestedName: suggestedName.slice(0, 180) }
}
