/**
 * Concept generator: UI labels and OpenRouter model IDs.
 * Single source of truth — UI loads options via GET /api/concept-generator-models.
 */
export interface ConceptGeneratorModelConfig {
  /** Stable id sent in API requests and stored with the chosen concept */
  id: string
  /** Display name in the UI and in result cards */
  label: string
  openrouterModelId: string
  /** Can analyze an attached reference image via OpenRouter vision. */
  supportsVision?: boolean
}

export const CONCEPT_GENERATOR_MODELS: ConceptGeneratorModelConfig[] = [
  { id: 'gpt-4o', label: 'GPT-4o', openrouterModelId: 'openai/gpt-4o', supportsVision: true },
  // Keep "Claude" label stable, use a currently routable Sonnet slug.
  { id: 'claude', label: 'Claude', openrouterModelId: 'anthropic/claude-sonnet-4', supportsVision: true },
  { id: 'gemini', label: 'Gemini', openrouterModelId: 'google/gemini-2.0-flash-001', supportsVision: true },
  { id: 'deepseek', label: 'DeepSeek', openrouterModelId: 'deepseek/deepseek-chat-v3-0324', supportsVision: true },
  { id: 'llama', label: 'Llama', openrouterModelId: 'meta-llama/llama-3.1-70b-instruct', supportsVision: false },
  { id: 'mistral', label: 'Mistral', openrouterModelId: 'mistralai/mistral-large-2512', supportsVision: true }
]

export function getConceptGeneratorModelById (id: string): ConceptGeneratorModelConfig | undefined {
  return CONCEPT_GENERATOR_MODELS.find(m => m.id === id)
}
