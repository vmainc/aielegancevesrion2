/** WaveSpeed AI video (Seedance 2.5 Turbo). Client + server — no secrets. */

import {
  isOpenRouterSeedance25Listing,
  isSeedance25ModelId,
  snapAtlasSeedanceDuration
} from '~/lib/atlas-cloud-video'

export const WAVESPEED_SEEDANCE_25_T2V_TURBO =
  'bytedance/seedance-2.5/text-to-video-turbo'
export const WAVESPEED_SEEDANCE_25_I2V_TURBO =
  'bytedance/seedance-2.5/image-to-video-turbo'

export const WAVESPEED_GENERATE_URL = (modelPath: string): string =>
  `https://api.wavespeed.ai/api/v3/${modelPath.replace(/^\/+/, '')}`

export const WAVESPEED_PREDICTION_RESULT_URL = (predictionId: string): string =>
  `https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(predictionId)}/result`

/** Same 4–30s clamp as Atlas / OpenRouter Seedance 2.5. */
export const snapWaveSpeedSeedanceDuration = snapAtlasSeedanceDuration

export function waveSpeedSeedanceResolution (
  requested: string | undefined
): '720p' | '1080p' {
  const s = String(requested || '').trim().toLowerCase()
  if (s === '1080p' || s === '4k' || s === '2k' || s === '1k') return '1080p'
  return '720p'
}

const WAVESPEED_ASPECTS = new Set(['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'])

export function waveSpeedSeedanceAspectRatio (aspectRatio?: string): string {
  const raw = String(aspectRatio || '').trim()
  if (!raw) return '16:9'
  if (raw === '9:21') return '9:16'
  if (WAVESPEED_ASPECTS.has(raw)) return raw
  return '16:9'
}

/**
 * OpenRouter Seedance 2.5 is 720p-max. Native 1080p goes through WaveSpeed Turbo when keyed.
 */
export function shouldRouteSeedance25ViaWaveSpeed (opts: {
  modelId: string
  resolution?: string | null
  waveSpeedKeyConfigured: boolean
}): boolean {
  if (!opts.waveSpeedKeyConfigured) return false
  if (!isSeedance25ModelId(opts.modelId)) return false
  return String(opts.resolution || '').trim().toLowerCase() === '1080p'
}

/** Advertise 1080p on Seedance 2.5 when a HD provider (WaveSpeed / Atlas) is configured. */
export function enrichSeedance25ResolutionsForHd (
  modelId: string,
  resolutions: string[] | undefined,
  hdConfigured: boolean
): string[] | undefined {
  if (!hdConfigured || !isOpenRouterSeedance25Listing(modelId)) return resolutions
  const base = resolutions?.length ? [...resolutions] : ['480p', '720p']
  if (!base.includes('1080p')) base.push('1080p')
  return base
}

function asRecord (v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function firstOutputUrl (outputs: unknown): string {
  if (typeof outputs === 'string' && /^https?:\/\//i.test(outputs.trim())) return outputs.trim()
  if (!Array.isArray(outputs) || !outputs.length) return ''
  const first = outputs[0]
  if (typeof first === 'string' && /^https?:\/\//i.test(first.trim())) return first.trim()
  const rec = asRecord(first)
  if (!rec) return ''
  for (const key of ['url', 'video_url', 'uri', 'href']) {
    const v = rec[key]
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim()
  }
  return ''
}

export type WaveSpeedPrediction = {
  id: string
  status: string
  videoUrl: string
  message: string
}

/**
 * Normalize WaveSpeed `{ code, data }` / bare prediction envelopes.
 */
export function parseWaveSpeedPrediction (json: unknown): WaveSpeedPrediction {
  const root = asRecord(json) || {}
  const data = asRecord(root.data) || (asRecord(root.id) ? root : {})
  const id = String(data.id || root.id || '').trim()
  const status = String(data.status || root.status || '').trim().toLowerCase()
  const videoUrl =
    firstOutputUrl(data.outputs) ||
    firstOutputUrl(root.outputs) ||
    (typeof data.output === 'string' ? firstOutputUrl([data.output]) : firstOutputUrl(data.output)) ||
    (typeof data.video_url === 'string' ? data.video_url.trim() : '')

  const err = data.error ?? root.error
  let message = ''
  if (typeof err === 'string' && err.trim()) message = err.trim()
  else {
    const rec = asRecord(err)
    if (rec && typeof rec.message === 'string' && rec.message.trim()) message = rec.message.trim()
  }
  if (!message) {
    for (const key of ['message', 'msg', 'error_message']) {
      const v = data[key] ?? root[key]
      if (typeof v === 'string' && v.trim()) {
        message = v.trim()
        break
      }
    }
  }

  return { id, status, videoUrl, message }
}

export function waveSpeedPredictionIsTerminalSuccess (status: string): boolean {
  return status.trim().toLowerCase() === 'completed'
}

export function waveSpeedPredictionIsTerminalFailure (status: string): boolean {
  const s = status.trim().toLowerCase()
  return s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'timeout' || s === 'deleted'
}
