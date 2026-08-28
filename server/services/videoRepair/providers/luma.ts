import { createError } from 'h3'
import { lumaModeForRepairMode } from '~/lib/video-repair/lumaMode'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'
import type {
  VideoRepairProviderAdapter,
  VideoRepairProviderPollResult,
  VideoRepairProviderStartInput,
  VideoRepairProviderStartResult
} from '../types'

const LUMA_BASE = 'https://api.lumalabs.ai/dream-machine/v1'
const LUMA_MODIFY_MODELS = new Set(['ray-2', 'ray-flash-2'])

export { lumaModeForRepairMode }

export function normalizeLumaModifyModel (model: string): string {
  const m = model.trim().toLowerCase()
  if (LUMA_MODIFY_MODELS.has(m)) return m
  if (m.includes('flash')) return 'ray-flash-2'
  return 'ray-2'
}

function lumaHeaders (apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
}

type LumaGeneration = {
  id?: string
  state?: string
  failure_reason?: string
  model?: string
  assets?: { video?: string; progress_video?: string }
}

function mapLumaState (state: string): VideoRepairProviderStartResult['status'] {
  const s = state.trim().toLowerCase()
  if (s === 'completed') return 'completed'
  if (s === 'failed') return 'failed'
  if (s === 'dreaming') return 'in_progress'
  return 'pending'
}

async function readJsonOrText (res: Response): Promise<{ json: unknown | null; text: string }> {
  const text = await res.text()
  try {
    return { json: JSON.parse(text) as unknown, text }
  } catch {
    return { json: null, text }
  }
}

function lumaErrorMessage (json: unknown, text: string, status: number): string {
  if (json && typeof json === 'object') {
    const d = (json as { detail?: unknown }).detail
    if (typeof d === 'string' && d.trim()) return d.trim()
    const m = (json as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m.trim()
  }
  return text.slice(0, 600) || `Luma Modify failed (HTTP ${status})`
}

export function createLumaVideoRepairAdapter (apiKey: string): VideoRepairProviderAdapter {
  const key = apiKey.trim()
  return {
    id: 'luma',

    async start (input: VideoRepairProviderStartInput): Promise<VideoRepairProviderStartResult> {
      if (!key) {
        throw createError({
          statusCode: 500,
          message: 'Luma API key not configured. Set LUMA_API_KEY in .env.'
        })
      }
      const sourceUrl = (input.publicSourceVideoUrl || input.sourceVideoUrl || '').trim()
      if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
        throw createError({
          statusCode: 400,
          message:
            'Luma Modify needs a publicly reachable source video URL. On local machines, set VIDEO_REPAIR_PUBLIC_BASE_URL to a tunnel, or use Auto / Runway Aleph.'
        })
      }

      const model = normalizeLumaModifyModel(input.model)
      const mode = lumaModeForRepairMode(input.repairMode)
      const prompt = input.prompt.trim().slice(0, 8000)

      const body: Record<string, unknown> = {
        generation_type: 'modify_video',
        prompt,
        media: { url: sourceUrl },
        model,
        mode
      }

      const refUrl = (input.publicReferenceImageUrl || input.referenceFrames[0]?.url || '').trim()
      if (refUrl && /^https?:\/\//i.test(refUrl)) {
        body.first_frame = { url: refUrl }
      }

      const created = await fetchWithTimeout(
        `${LUMA_BASE}/generations/video/modify`,
        { method: 'POST', headers: lumaHeaders(key), body: JSON.stringify(body) },
        60_000
      )
      const parsed = await readJsonOrText(created)
      if (!created.ok) {
        const raw = lumaErrorMessage(parsed.json, parsed.text, created.status)
        console.error('[video-repair:luma] create failed', created.status, raw)
        throw createError({
          statusCode: created.status === 401 ? 401 : 502,
          message: userFacingLumaError(raw, created.status)
        })
      }

      const json = (parsed.json || {}) as LumaGeneration
      const jobId = String(json.id || '').trim()
      if (!jobId) {
        throw createError({ statusCode: 502, message: 'Luma did not return a generation id.' })
      }
      const pollUrl = `${LUMA_BASE}/generations/${encodeURIComponent(jobId)}`
      const status = mapLumaState(String(json.state || 'queued'))
      if (status === 'failed') {
        throw createError({
          statusCode: 502,
          message: json.failure_reason?.trim() || 'Luma Modify failed.'
        })
      }
      if (status === 'completed' && json.assets?.video) {
        return {
          providerJobId: jobId,
          pollUrl,
          model,
          status: 'completed',
          outputVideoUrl: json.assets.video
        }
      }
      return { providerJobId: jobId, pollUrl, model, status }
    },

    async poll (
      pollUrl: string,
      providerJobId: string,
      model: string
    ): Promise<VideoRepairProviderPollResult> {
      const poll = await fetchWithTimeout(pollUrl, { method: 'GET', headers: lumaHeaders(key) }, 60_000)
      const parsed = await readJsonOrText(poll)
      if (!poll.ok) {
        console.error('[video-repair:luma] poll failed', poll.status, parsed.text.slice(0, 400))
        throw createError({ statusCode: 502, message: 'Could not check Luma repair progress.' })
      }
      const j = (parsed.json || {}) as LumaGeneration
      const status = mapLumaState(String(j.state || 'queued'))
      if (status === 'failed') {
        return {
          status: 'failed',
          providerJobId,
          model,
          message: j.failure_reason?.trim() || 'Luma Modify failed.'
        }
      }
      if (status === 'completed') {
        const url = String(j.assets?.video || '').trim()
        if (!url) {
          return {
            status: 'failed',
            providerJobId,
            model,
            message: 'Luma finished but did not return a video.'
          }
        }
        return { status: 'completed', providerJobId, model, outputVideoUrl: url }
      }
      return { status: status === 'in_progress' ? 'in_progress' : 'pending', providerJobId, model }
    }
  }
}

function userFacingLumaError (raw: string, httpStatus: number): string {
  if (httpStatus === 401) return 'Luma authentication failed. Check LUMA_API_KEY.'
  if (httpStatus === 429) return 'Luma is rate-limiting repairs. Wait a moment and try again.'
  if (/url|fetch|download|not accessible|unreachable/i.test(raw)) {
    return 'Luma could not download the source video. The clip needs a public URL (production) or a tunnel in local development.'
  }
  return 'Luma could not start this repair. Try Auto or check the source clip.'
}
