export type CompareModel = {
  id: string
  name: string
  provider: string
  enabled?: boolean
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type CompareChatRequest = {
  prompt: string
  /** Reserved for follow-ups; unused in MVP. */
  conversationId?: string
  messages?: ChatMessage[]
}

export type CompareResult = {
  modelId: string
  modelName: string
  provider: string
  content: string
  error: string | null
  duration: number
}

const DEFAULT_MODELS: CompareModel[] = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', provider: 'OpenAI' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet', provider: 'Anthropic' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini Flash', provider: 'Google' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta' }
]

export function parseModelsConfig (raw: string | undefined | null): CompareModel[] {
  const text = String(raw || '').trim()
  if (!text) return DEFAULT_MODELS.filter(m => m.enabled !== false)
  try {
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed)) return DEFAULT_MODELS
    const out: CompareModel[] = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const rec = row as Record<string, unknown>
      const id = typeof rec.id === 'string' ? rec.id.trim() : ''
      if (!id) continue
      if (rec.enabled === false) continue
      out.push({
        id,
        name: typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : id,
        provider: typeof rec.provider === 'string' && rec.provider.trim() ? rec.provider.trim() : 'Model'
      })
    }
    return out.length ? out : DEFAULT_MODELS
  } catch {
    return DEFAULT_MODELS
  }
}

export function publicModels (models: CompareModel[]): Array<Pick<CompareModel, 'id' | 'name' | 'provider'>> {
  return models.map(({ id, name, provider }) => ({ id, name, provider }))
}

export function sanitizeProviderError (status: number, timedOut: boolean): string {
  if (timedOut) return 'Timed out waiting for this model.'
  if (status === 401 || status === 403) return 'This model is unavailable right now.'
  if (status === 429) return 'This model is busy. Try again in a moment.'
  if (status >= 500) return 'This model failed to respond.'
  return 'Could not get a response from this model.'
}

export function clampPrompt (prompt: string, maxChars: number): string {
  return prompt.trim().slice(0, Math.max(1, maxChars))
}

export function resolveMessages (body: CompareChatRequest): ChatMessage[] {
  if (Array.isArray(body.messages) && body.messages.length) {
    return body.messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system'))
      .map(m => ({ role: m.role, content: String(m.content || '').trim() }))
      .filter(m => m.content)
  }
  const prompt = String(body.prompt || '').trim()
  return prompt ? [{ role: 'user', content: prompt }] : []
}
