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
  { id: 'claude', label: 'Claude', openrouterModelId: 'anthropic/claude-sonnet-4' },
  { id: 'mixtral', label: 'Mixtral', openrouterModelId: 'mistralai/mixtral-8x7b-instruct' }
]

export function getConceptGeneratorModelById (id: string): ConceptGeneratorModelConfig | undefined {
  return CONCEPT_GENERATOR_MODELS.find(m => m.id === id)
}
