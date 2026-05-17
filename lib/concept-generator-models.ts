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
}

export const CONCEPT_GENERATOR_MODELS: ConceptGeneratorModelConfig[] = [
  { id: 'gpt-4o', label: 'GPT-4o', openrouterModelId: 'openai/gpt-4o' },
  // Keep "Claude" label stable, use a currently routable Sonnet slug.
  { id: 'claude', label: 'Claude', openrouterModelId: 'anthropic/claude-sonnet-4' },
  { id: 'gemini', label: 'Gemini', openrouterModelId: 'google/gemini-2.0-flash-001' },
  { id: 'deepseek', label: 'DeepSeek', openrouterModelId: 'deepseek/deepseek-chat-v3-0324' },
  { id: 'llama', label: 'Llama', openrouterModelId: 'meta-llama/llama-3.1-70b-instruct' },
  { id: 'mistral', label: 'Mistral', openrouterModelId: 'mistralai/mistral-large-2512' },
  { id: 'mixtral', label: 'Mixtral', openrouterModelId: 'mistralai/mixtral-8x7b-instruct' }
]

export function getConceptGeneratorModelById (id: string): ConceptGeneratorModelConfig | undefined {
  return CONCEPT_GENERATOR_MODELS.find(m => m.id === id)
}
