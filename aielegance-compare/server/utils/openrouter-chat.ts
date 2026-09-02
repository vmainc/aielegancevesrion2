import type { ChatMessage, CompareModel, CompareResult } from '../../lib/compare'
import { sanitizeProviderError } from '../../lib/compare'

type CompleteArgs = {
  model: CompareModel
  messages: ChatMessage[]
  systemPrompt: string
  apiKey: string
  baseUrl: string
  referer: string
  title: string
  maxOutputTokens: number
  timeoutMs: number
}

function headers (args: CompleteArgs): Record<string, string> {
  return {
    Authorization: `Bearer ${args.apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'HTTP-Referer': args.referer,
    'X-Title': args.title
  }
}

function extractContent (json: unknown): string {
  if (!json || typeof json !== 'object') return ''
  const choices = (json as { choices?: unknown }).choices
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return ''
  const msg = (choices[0] as { message?: { content?: unknown } }).message
  if (typeof msg?.content === 'string') return msg.content.trim()
  return ''
}

export async function completeChat (args: CompleteArgs): Promise<CompareResult> {
  const started = Date.now()
  const base = args.baseUrl.replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), args.timeoutMs)
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: headers(args),
      signal: controller.signal,
      body: JSON.stringify({
        model: args.model.id,
        messages: [
          { role: 'system', content: args.systemPrompt },
          ...args.messages
        ],
        max_tokens: args.maxOutputTokens,
        temperature: 0.7
      })
    })
    const duration = Date.now() - started
    if (!res.ok) {
      return {
        modelId: args.model.id,
        modelName: args.model.name,
        provider: args.model.provider,
        content: '',
        error: sanitizeProviderError(res.status, false),
        duration
      }
    }
    const json = await res.json().catch(() => null)
    const content = extractContent(json)
    if (!content) {
      return {
        modelId: args.model.id,
        modelName: args.model.name,
        provider: args.model.provider,
        content: '',
        error: sanitizeProviderError(502, false),
        duration
      }
    }
    return {
      modelId: args.model.id,
      modelName: args.model.name,
      provider: args.model.provider,
      content,
      error: null,
      duration
    }
  } catch (e) {
    const timedOut = (e as { name?: string })?.name === 'AbortError'
    return {
      modelId: args.model.id,
      modelName: args.model.name,
      provider: args.model.provider,
      content: '',
      error: sanitizeProviderError(0, timedOut),
      duration: Date.now() - started
    }
  } finally {
    clearTimeout(timer)
  }
}
