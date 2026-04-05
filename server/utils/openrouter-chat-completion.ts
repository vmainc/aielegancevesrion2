/**
 * OpenRouter chat/completions request body + provider steering.
 * @see https://openrouter.ai/docs/guides/routing/provider-selection
 */
export function openRouterProviderPrefs(
  modelId: string
): Record<string, unknown> | undefined {
  if (modelId.startsWith('anthropic/')) {
    // Prefer Anthropic direct API; Bedrock can return "invalid model identifier" for some IDs.
    return { order: ['anthropic'] }
  }
  if (modelId.startsWith('google/')) {
    // Prefer Google AI Studio / Vertex when default routing returns "No endpoints".
    return { order: ['google-ai-studio', 'google-vertex'] }
  }
  return undefined
}

export function buildOpenRouterChatCompletionBody(options: {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  max_tokens?: number
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 1024
  }
  const prefs = openRouterProviderPrefs(options.model)
  if (prefs) {
    body.provider = prefs
  }
  return body
}
