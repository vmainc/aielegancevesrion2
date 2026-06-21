import { fetchImageAsDataUrlForVideo } from '~/server/utils/openrouter-video-job'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'

function orOpenRouterHeaders (apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/json'
  }
  if (process.env.OPENROUTER_REFERER) headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE
  if (!headers['HTTP-Referer']) headers['HTTP-Referer'] = 'https://aielegance.com'
  if (!headers['X-Title']) headers['X-Title'] = 'AI Elegance Music'
  return headers
}

type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

function parseSseJsonLines (raw: string): unknown[] {
  const out: unknown[] = []
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('data:')) continue
    const payload = t.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      out.push(JSON.parse(payload))
    } catch {
      /* skip */
    }
  }
  return out
}

function appendAudioDelta (chunks: string[], delta: unknown): void {
  if (!delta || typeof delta !== 'object') return
  const d = delta as Record<string, unknown>
  const audio = d.audio
  if (typeof audio === 'string' && audio) {
    chunks.push(audio)
    return
  }
  if (audio && typeof audio === 'object') {
    const data = (audio as { data?: unknown }).data
    if (typeof data === 'string' && data) chunks.push(data)
  }
  const content = d.content
  if (typeof content === 'string' && content.startsWith('data:audio')) {
    const comma = content.indexOf(',')
    if (comma >= 0) chunks.push(content.slice(comma + 1))
  }
}

function extractAudioFromMessage (message: unknown, chunks: string[]): void {
  if (!message || typeof message !== 'object') return
  const m = message as Record<string, unknown>
  appendAudioDelta(chunks, m.audio)
  const content = m.content
  if (typeof content === 'string' && content.length > 100) {
    chunks.push(content)
  }
}

function collectAudioBase64FromEvents (events: unknown[]): string {
  const chunks: string[] = []
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue
    const o = ev as Record<string, unknown>
    const choices = o.choices
    if (Array.isArray(choices)) {
      for (const choice of choices) {
        if (!choice || typeof choice !== 'object') continue
        const c = choice as Record<string, unknown>
        appendAudioDelta(chunks, c.delta)
        extractAudioFromMessage(c.message, chunks)
      }
    }
    extractAudioFromMessage(o.message, chunks)
    appendAudioDelta(chunks, o.audio)
  }
  return chunks.join('')
}

export async function openRouterGenerateMusic (options: {
  prompt: string
  model: string
  apiKey: string
  referenceImageUrl?: string
}): Promise<{ buffer: Buffer; transcript: string }> {
  const prompt = options.prompt.trim().slice(0, 8000)
  if (!prompt) {
    throw new Error('Prompt is required')
  }
  const model = options.model.trim()
  if (!model) {
    throw new Error('Model is required')
  }

  const content: MessageContentPart[] = [{ type: 'text', text: prompt }]
  if (options.referenceImageUrl?.trim()) {
    const dataUrl = await fetchImageAsDataUrlForVideo(options.referenceImageUrl.trim(), 6_000_000)
    content.push({ type: 'image_url', image_url: { url: dataUrl } })
  }

  const body = {
    model,
    messages: [{ role: 'user', content }],
    modalities: ['text', 'audio'],
    stream: true,
    audio: { format: 'mp3' }
  }

  const res = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: orOpenRouterHeaders(options.apiKey),
      body: JSON.stringify(body)
    },
    8 * 60 * 1000
  )

  const raw = await res.text()
  if (!res.ok) {
    let msg = raw.slice(0, 800)
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } }
      msg = j.error?.message || msg
    } catch {
      /* keep raw */
    }
    throw new Error(msg || `OpenRouter music generation failed (HTTP ${res.status})`)
  }

  const events = parseSseJsonLines(raw)
  const b64 = collectAudioBase64FromEvents(events).replace(/\s/g, '')
  if (!b64) {
    throw new Error(
      'OpenRouter returned no audio data. Try Lyria 3 Clip for a shorter score bed, or simplify your prompt.'
    )
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(b64, 'base64')
  } catch {
    throw new Error('Could not decode generated audio from OpenRouter.')
  }
  if (buffer.length < 512) {
    throw new Error('Generated audio file was too small — try again or pick a different model.')
  }

  let transcript = ''
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue
    const choices = (ev as { choices?: unknown[] }).choices
    if (!Array.isArray(choices)) continue
    for (const choice of choices) {
      const delta = (choice as { delta?: { audio?: { transcript?: string } } })?.delta
      const t = delta?.audio?.transcript
      if (typeof t === 'string' && t.trim()) transcript += t
    }
  }

  return { buffer, transcript: transcript.trim() }
}
