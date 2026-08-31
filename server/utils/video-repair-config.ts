import { VIDEO_REPAIR_DEFAULTS } from '~/lib/video-repair/limits'
import type { VideoRepairProviderId } from '~/lib/video-repair/types'

function envInt (key: string, fallback: number, min: number, max: number): number {
  const raw = process.env[key]
  const n = raw != null && String(raw).trim() ? Number(raw) : fallback
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function envStr (key: string, fallback: string): string {
  const v = process.env[key]
  return v != null && String(v).trim() ? String(v).trim() : fallback
}

export function resolveLumaApiKey (config?: { lumaApiKey?: string }): string | undefined {
  const v =
    (config?.lumaApiKey && String(config.lumaApiKey).trim()) ||
    process.env.NUXT_LUMA_API_KEY ||
    process.env.LUMA_API_KEY
  const s = v ? String(v).trim() : ''
  return s || undefined
}

export function getVideoRepairLimits () {
  return {
    maxDurationSeconds: envInt(
      'VIDEO_REPAIR_MAX_DURATION',
      VIDEO_REPAIR_DEFAULTS.maxDurationSeconds,
      2,
      120
    ),
    maxUploadMb: envInt('VIDEO_REPAIR_MAX_UPLOAD_MB', VIDEO_REPAIR_DEFAULTS.maxUploadMb, 5, 500),
    maxConcurrentJobs: envInt(
      'VIDEO_REPAIR_MAX_CONCURRENT_JOBS',
      VIDEO_REPAIR_DEFAULTS.maxConcurrentJobs,
      1,
      8
    )
  }
}

export function getVideoRepairMaxBytes (): number {
  return getVideoRepairLimits().maxUploadMb * 1024 * 1024
}

export function getVideoRepairDefaultProvider (): VideoRepairProviderId {
  const v = envStr('VIDEO_REPAIR_DEFAULT_PROVIDER', VIDEO_REPAIR_DEFAULTS.defaultProvider).toLowerCase()
  return v === 'luma' ? 'luma' : 'openrouter'
}

export function getVideoRepairDefaultModel (): string {
  return envStr('VIDEO_REPAIR_DEFAULT_MODEL', VIDEO_REPAIR_DEFAULTS.defaultModel)
}

export function getLumaModifyModel (): string {
  return envStr('LUMA_MODIFY_MODEL', VIDEO_REPAIR_DEFAULTS.lumaModel)
}

/** Public origin providers can fetch tokenized media from. */
export function getVideoRepairPublicBaseUrl (): string {
  // Prefer an explicit HTTPS origin. OPENROUTER_REFERER is a reasonable fallback on prod.
  const raw = envStr(
    'VIDEO_REPAIR_PUBLIC_BASE_URL',
    envStr('OPENROUTER_REFERER', envStr('NUXT_PUBLIC_SITE_URL', ''))
  ).replace(/\/+$/, '')
  if (!raw) return ''
  if (/^http:\/\//i.test(raw)) return `https://${raw.slice('http://'.length)}`
  return raw
}

/** Aleph list price as of docs — used only for internal cost estimates. */
const OPENROUTER_ALEPH_USD_PER_SECOND = 0.28

export function estimateRepairCostUsd (opts: {
  provider: VideoRepairProviderId
  model: string
  durationSeconds: number | null
}): number | null {
  const dur = opts.durationSeconds
  if (dur == null || !Number.isFinite(dur) || dur <= 0) return null
  if (opts.provider === 'openrouter' && /aleph/i.test(opts.model)) {
    return Math.round(dur * OPENROUTER_ALEPH_USD_PER_SECOND * 100) / 100
  }
  return null
}
