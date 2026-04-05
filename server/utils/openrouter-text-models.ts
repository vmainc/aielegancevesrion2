/**
 * UI model labels → OpenRouter chat model IDs.
 * Stale slugs (e.g. preview checkpoints) return 404; old Anthropic IDs can fail on Bedrock routing.
 */
export const OPENROUTER_TEXT_MODEL_MAP: Record<string, string> = {
  ChatGPT: 'openai/gpt-4o',
  // Sonnet 4 + ignore Bedrock; 2.0 Flash has broad endpoint coverage vs 2.5 on some keys
  Claude: 'anthropic/claude-sonnet-4',
  Gemini: 'google/gemini-2.0-flash-001',
  Mistral: 'mistralai/mistral-large-2512',
  DeepSeek: 'deepseek/deepseek-chat',
  LLaMA: 'meta-llama/llama-3.1-70b-instruct',
  Grok: 'x-ai/grok-4.1-fast',
  Perplexity: 'perplexity/sonar-pro-search'
}
