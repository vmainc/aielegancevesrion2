import { createError } from 'h3'
import { ALEPH_PROMPT_MAX_CHARS, repairModePromptAddon } from '~/lib/video-repair/promptBuilder'
import type { RepairMode } from '~/lib/video-repair/types'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'
import { assertHttpsProviderMediaUrl } from '~/server/utils/video-repair-public-url'
import type {
  VideoRepairProviderAdapter,
  VideoRepairProviderPollResult,
  VideoRepairProviderStartInput,
  VideoRepairProviderStartResult
} from '../types'

/** Aleph image guidance via Runway keyframes passthrough (HTTPS URIs only). */
async function buildAlephKeyframes (
  input: VideoRepairProviderStartInput
): Promise<Array<{ uri: string; seconds: number }>> {
  const publicRef = (input.publicReferenceImageUrl || '').trim()
  const frame = input.referenceFrames[0]
  const candidate = /^https:\/\//i.test(publicRef)
    ? publicRef
    : (frame?.url || '').trim()
  if (!candidate || candidate.startsWith('data:') || !/^https:\/\//i.test(candidate)) {
    // Skip non-HTTPS refs rather than poisoning the request with image_url/references.
    return []
  }
  const uri = assertHttpsProviderMediaUrl(candidate, 'Reference image')
  const seconds =
    typeof frame?.timestampSeconds === 'number' && Number.isFinite(frame.timestampSeconds)
      ? Math.max(0, frame.timestampSeconds)
      : 0
  return [{ uri, seconds }]
}

type VideoJobResponse = {
  id?: string
  polling_url?: string
  status?: string
  unsigned_urls?: string[]
  error?: unknown
  usage?: { cost?: unknown }
}

function orHeaders (apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
  if (process.env.OPENROUTER_REFERER) headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE
  if (!headers['HTTP-Referer']) headers['HTTP-Referer'] = 'https://aifilmstud.io'
  if (!headers['X-Title']) headers['X-Title'] = 'AI Film Studio Repair'
  return headers
}

function jobErrorMessage (j: VideoJobResponse): string {
  const e = j.error
  if (typeof e === 'string' && e.trim()) return e.trim()
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m.trim()
  }
  return 'Video repair failed'
}

function readCost (j: VideoJobResponse): number | null {
  const c = j.usage?.cost
  const n = typeof c === 'number' ? c : Number(c)
  return Number.isFinite(n) && n >= 0 ? n : null
}

async function readJsonOrText (res: Response): Promise<{ json: unknown | null; text: string }> {
  const text = await res.text()
  try {
    return { json: JSON.parse(text) as unknown, text }
  } catch {
    return { json: null, text }
  }
}

function mapStatus (raw: string): VideoRepairProviderStartResult['status'] {
  const s = raw.trim()
  if (s === 'completed') return 'completed'
  if (s === 'failed') return 'failed'
  if (s === 'cancelled') return 'cancelled'
  if (s === 'expired') return 'expired'
  if (s === 'in_progress' || s === 'processing') return 'in_progress'
  return 'pending'
}

function promptForMode (prompt: string, mode: RepairMode): string {
  // Aleph promptText max is 1000 chars — never send more.
  const addon = repairModePromptAddon(mode)
  const base = prompt.includes(addon) ? prompt : `${prompt}\n${addon}`
  return base.trim().slice(0, ALEPH_PROMPT_MAX_CHARS)
}

function videoContentUrl (jobId: string, unsigned?: string[]): string {
  const u0 = Array.isArray(unsigned) ? String(unsigned[0] || '').trim() : ''
  return u0 || `https://openrouter.ai/api/v1/videos/${encodeURIComponent(jobId)}/content?index=0`
}

export function createOpenRouterVideoRepairAdapter (apiKey: string): VideoRepairProviderAdapter {
  const key = apiKey.trim()
  return {
    id: 'openrouter',

    async start (input: VideoRepairProviderStartInput): Promise<VideoRepairProviderStartResult> {
      if (!key) {
        throw createError({
          statusCode: 500,
          message: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env.'
        })
      }
      const model = input.model.trim()
      if (!model) {
        throw createError({ statusCode: 400, message: 'A repair model is required.' })
      }
      const prompt = promptForMode(input.prompt.trim(), input.repairMode)
      if (!prompt) {
        throw createError({ statusCode: 400, message: 'A repair instruction is required.' })
      }

      // Aleph rejects data: and http: for video_url — HTTPS only.
      const sourceUrl = assertHttpsProviderMediaUrl(
        input.publicSourceVideoUrl || input.sourceVideoUrl || '',
        'Source video'
      )

      // Aleph requires the source as input_references[video_url] only.
      // Do NOT put images in input_references — OpenRouter maps those to Runway
      // `references`, which Aleph rejects ("Unrecognized key: references").
      // Reference images go through allowed passthrough: provider.options.runway.keyframes.
      const inputReferences: Array<Record<string, unknown>> = [
        {
          type: 'video_url',
          video_url: { url: sourceUrl }
        }
      ]

      const body: Record<string, unknown> = {
        model,
        prompt,
        input_references: inputReferences
      }
      if (input.aspectRatio) body.aspect_ratio = input.aspectRatio

      const keyframes = await buildAlephKeyframes(input)
      if (keyframes.length) {
        body.provider = {
          options: {
            runway: { keyframes }
          }
        }
      }

      const created = await fetchWithTimeout(
        'https://openrouter.ai/api/v1/videos',
        { method: 'POST', headers: orHeaders(key), body: JSON.stringify(body) },
        120_000
      )
      const parsed = await readJsonOrText(created)
      if (!created.ok) {
        let msg = parsed.text.slice(0, 800) || `OpenRouter video repair failed (HTTP ${created.status})`
        if (parsed.json && typeof parsed.json === 'object' && parsed.json !== null) {
          const errMsg = (parsed.json as { error?: { message?: unknown } }).error?.message
          if (typeof errMsg === 'string' && errMsg.trim()) msg = errMsg.trim()
        }
        console.error(
          '[video-repair:openrouter] create failed',
          created.status,
          msg,
          'source=',
          sourceUrl.startsWith('data:') ? `data-uri(${sourceUrl.length} chars)` : sourceUrl.slice(0, 120)
        )
        throw createError({
          statusCode: created.status === 401 ? 401 : created.status === 402 ? 402 : 502,
          message: userFacingOpenRouterError(msg, created.status)
        })
      }

      const json = (parsed.json || {}) as VideoJobResponse
      const jobId = String(json.id || '').trim()
      const pollUrl =
        String(json.polling_url || '').trim() ||
        `https://openrouter.ai/api/v1/videos/${encodeURIComponent(jobId)}`
      if (!jobId) {
        throw createError({ statusCode: 502, message: 'The repair service did not return a job id.' })
      }

      const status = mapStatus(String(json.status || ''))
      if (status === 'failed' || status === 'cancelled' || status === 'expired') {
        throw createError({ statusCode: 502, message: jobErrorMessage(json) })
      }
      if (status === 'completed') {
        return {
          providerJobId: jobId,
          pollUrl,
          model,
          status: 'completed',
          outputVideoUrl: videoContentUrl(jobId, json.unsigned_urls),
          actualCost: readCost(json)
        }
      }
      return { providerJobId: jobId, pollUrl, model, status }
    },

    async poll (
      pollUrl: string,
      providerJobId: string,
      model: string
    ): Promise<VideoRepairProviderPollResult> {
      const poll = await fetchWithTimeout(pollUrl, { method: 'GET', headers: orHeaders(key) }, 60_000)
      const parsed = await readJsonOrText(poll)
      if (!poll.ok) {
        const msg = parsed.text.slice(0, 800) || `OpenRouter poll failed (HTTP ${poll.status})`
        console.error('[video-repair:openrouter] poll failed', poll.status, msg)
        throw createError({ statusCode: 502, message: 'Could not check repair progress. Try again in a moment.' })
      }
      const j = (parsed.json || {}) as VideoJobResponse
      const status = mapStatus(String(j.status || 'pending'))
      if (status === 'failed' || status === 'cancelled' || status === 'expired') {
        return { status, providerJobId, model, message: jobErrorMessage(j) }
      }
      if (status === 'completed') {
        return {
          status: 'completed',
          providerJobId,
          model,
          outputVideoUrl: videoContentUrl(providerJobId, j.unsigned_urls),
          actualCost: readCost(j)
        }
      }
      return { status: status === 'in_progress' ? 'in_progress' : 'pending', providerJobId, model }
    }
  }
}

function userFacingOpenRouterError (raw: string, httpStatus: number): string {
  const short = raw.replace(/\s+/g, ' ').trim().slice(0, 220)
  const t = raw.toLowerCase()
  if (httpStatus === 401) return 'Repair service authentication failed. Check OPENROUTER_API_KEY.'
  if (httpStatus === 402) return 'Not enough OpenRouter credits to run this repair.'
  if (httpStatus === 429) return 'The repair service is busy. Wait a moment and try again.'
  if (/content policy|moderation|safety/i.test(t)) {
    return 'The repair was blocked by the model’s content policy. Adjust the clip or instructions.'
  }
  if (/unsupported|unknown model|not found/i.test(t)) {
    return short
      ? `This repair model is not available: ${short}`
      : 'This repair model is not available right now. Try Auto or another engine in Advanced.'
  }
  // Always surface a short provider message — generic 502s are otherwise undiagnosable in prod.
  if (short) {
    return `The repair service could not start this job: ${short}`
  }
  return 'The repair service could not start this job. Check the clip length and try again.'
}
