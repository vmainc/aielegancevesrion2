import { createError } from 'h3'
import { parseVideoStartFrameRef, videoStartFramePublicUrl } from '~/lib/video-start-frame-ref'
import { compressImageBufferForVideoSeed } from '~/server/utils/compress-image-for-video-seed'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { resolveReferenceImageUrlForServerFetch } from '~/server/utils/resolve-pocketbase-proxied-url-for-fetch'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import {
  newVideoStartFrameId,
  saveVideoStartFrame
} from '~/server/utils/video-start-frame-store'

function hostNeedsOpenRouterAuth (urlStr: string): boolean {
  try {
    const h = new URL(urlStr).hostname.toLowerCase()
    return h === 'openrouter.ai' || h.endsWith('.openrouter.ai')
  } catch {
    return false
  }
}

function looksLikeInternalPocketBaseUrl (urlStr: string, internalBase: string): boolean {
  const base = internalBase.trim().replace(/\/+$/, '')
  if (!base) return false
  try {
    return new URL(urlStr).origin === new URL(base).origin
  } catch {
    return false
  }
}

function parseDataUrl (dataUrl: string): { data: Buffer; mime: string } {
  const raw = dataUrl.trim()
  const comma = raw.indexOf(',')
  if (!raw.startsWith('data:') || comma < 0) {
    throw createError({ statusCode: 400, message: 'Invalid image data URL' })
  }
  const meta = raw.slice(0, comma)
  const mime = meta.match(/^data:([^;]+)/i)?.[1] || 'image/jpeg'
  const data = Buffer.from(raw.slice(comma + 1), 'base64')
  return { data, mime }
}

async function loadImageBytes (sourceUrl: string): Promise<Buffer> {
  const u = sourceUrl.trim()
  if (!u) {
    throw createError({ statusCode: 400, message: 'Missing image URL' })
  }
  if (u.startsWith('data:')) {
    return parseDataUrl(u).data
  }

  const config = useRuntimeConfig()
  const internalPb = String(config.pocketbaseInternalUrl || '').trim()
  const publicPb = String(config.public?.pocketbaseUrl || '').trim()

  let resolved: string
  try {
    resolved = await resolveReferenceImageUrlForServerFetch(u, {
      pocketbaseInternalUrl: internalPb,
      publicPocketbaseUrl: publicPb || undefined
    })
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode
    if (status && status >= 400 && status < 600) throw e
    throw createError({
      statusCode: 400,
      message: `Could not resolve starting frame URL: ${u.slice(0, 120)}`
    })
  }

  if (!resolved || parseVideoStartFrameRef(resolved)) {
    throw createError({ statusCode: 400, message: 'Starting frame URL could not be loaded' })
  }

  const headers: Record<string, string> = { Accept: 'image/*' }
  if (hostNeedsOpenRouterAuth(resolved)) {
    const apiKey = resolveOpenRouterApiKey(config)
    if (!apiKey) {
      throw createError({
        statusCode: 500,
        message: 'OPENROUTER_API_KEY is required to download OpenRouter-hosted images.'
      })
    }
    headers.Authorization = `Bearer ${apiKey}`
  } else if (looksLikeInternalPocketBaseUrl(resolved, internalPb)) {
    const pb = await getAuthenticatedPocketBase()
    const token = pb.authStore?.token?.trim()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetchWithTimeout(resolved, { method: 'GET', headers }, 45_000)
  } catch {
    throw createError({
      statusCode: 502,
      message: 'Could not download starting frame image (network error).'
    })
  }
  if (!res.ok) {
    throw createError({
      statusCode: 400,
      message: `Could not download image for video starting frame (HTTP ${res.status})`
    })
  }
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Compress (if needed), validate size, and return a short `/api/generate/video/start-frame/…` URL.
 */
export async function stageImageForVideoStartFrame (sourceUrl: string): Promise<string> {
  const u = sourceUrl.trim()
  if (!u) {
    throw createError({ statusCode: 400, message: 'Missing image URL' })
  }

  const existingId = parseVideoStartFrameRef(u)
  if (existingId) return u

  const raw = await loadImageBytes(u)
  const { data, mime } = await compressImageBufferForVideoSeed(raw)

  const id = newVideoStartFrameId()
  await saveVideoStartFrame(id, data, mime)
  return videoStartFramePublicUrl(id)
}
