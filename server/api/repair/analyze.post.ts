import { createError, readBody } from 'h3'
import {
  ANALYSIS_TYPE_TO_CATEGORY,
  SHOT_ANALYSIS_TYPES,
  type ShotAnalysisFinding,
  type ShotAnalysisResult,
  type ShotAnalysisType
} from '~/lib/video-repair/analyze'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'
import { imageDataUriFromMedia } from '~/server/utils/video-repair-source'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'

const ANALYZE_MODEL = process.env.VIDEO_REPAIR_ANALYZE_MODEL || 'openai/gpt-4o-mini'

function str (v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function parseFindings (raw: unknown): ShotAnalysisFinding[] {
  if (!Array.isArray(raw)) return []
  const out: ShotAnalysisFinding[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const type = String(r.type || '').trim() as ShotAnalysisType
    if (!(SHOT_ANALYSIS_TYPES as readonly string[]).includes(type)) continue
    const severity = r.severity === 'high' || r.severity === 'medium' || r.severity === 'low' ? r.severity : 'medium'
    const startTime = Number(r.startTime)
    const endTime = Number(r.endTime)
    const description = str(r.description).slice(0, 400)
    const confidence = Number(r.confidence)
    if (!description) continue
    out.push({
      type,
      severity,
      startTime: Number.isFinite(startTime) ? startTime : 0,
      endTime: Number.isFinite(endTime) ? endTime : startTime || 0,
      description,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
      repairCategory: ANALYSIS_TYPE_TO_CATEGORY[type]
    })
  }
  return out.slice(0, 16)
}

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  checkRateLimit(rateLimitKey(userId, 'repair-analyze'), 8, 60_000)

  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const frameMediaIds = Array.isArray(body.frameMediaIds)
    ? body.frameMediaIds.filter((x): x is string => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, 4)
    : []
  const frameDataUrls = Array.isArray(body.frameDataUrls)
    ? body.frameDataUrls.filter((x): x is string => typeof x === 'string' && x.startsWith('data:image/')).slice(0, 4)
    : []

  const images: string[] = [...frameDataUrls]
  for (const id of frameMediaIds) {
    try {
      images.push(await imageDataUriFromMedia(id))
    } catch {
      /* skip expired frames */
    }
  }

  if (!images.length) {
    const empty: ShotAnalysisResult = {
      experimental: true,
      findings: [],
      summary: 'Analyze Shot is experimental. Extract or upload a reference frame, then run analysis again.'
    }
    return empty
  }

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env.'
    })
  }

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: 'text',
      text: `You are a film continuity analyst. These stills are sampled from one AI-generated shot. Identify likely continuity problems only. Return JSON only:
{"summary":"one sentence","findings":[{"type":"face_consistency","severity":"low|medium|high","startTime":0,"endTime":0,"description":"...","confidence":0.0}]}
Allowed type values: ${SHOT_ANALYSIS_TYPES.join(', ')}
If nothing looks wrong, return findings: []. Do not invent issues. This is experimental and approximate.`
    }
  ]
  for (const url of images) {
    content.push({ type: 'image_url', image_url: { url } })
  }

  const payload = buildOpenRouterChatCompletionBody({
    model: ANALYZE_MODEL,
    messages: [{ role: 'user', content }],
    temperature: 0.2,
    max_tokens: 900
  })

  const res = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    },
    60_000
  )
  const text = await res.text()
  if (!res.ok) {
    console.error('[video-repair:analyze] openrouter failed', res.status, text.slice(0, 400))
    throw createError({
      statusCode: 502,
      message: 'Analyze Shot could not run right now. You can still Fix Shot manually.'
    })
  }

  let message = ''
  try {
    const json = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> }
    message = json.choices?.[0]?.message?.content || ''
  } catch {
    message = ''
  }

  const jsonStart = message.indexOf('{')
  const jsonEnd = message.lastIndexOf('}')
  let parsed: { summary?: string; findings?: unknown } = {}
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      parsed = JSON.parse(message.slice(jsonStart, jsonEnd + 1)) as { summary?: string; findings?: unknown }
    } catch {
      parsed = {}
    }
  }

  const findings = parseFindings(parsed.findings)
  const result: ShotAnalysisResult = {
    experimental: true,
    findings,
    summary:
      str(parsed.summary) ||
      (findings.length
        ? `Found ${findings.length} possible issue${findings.length === 1 ? '' : 's'} (experimental).`
        : 'No obvious issues from the sampled frames (experimental).'),
    model: ANALYZE_MODEL
  }
  return result
})
