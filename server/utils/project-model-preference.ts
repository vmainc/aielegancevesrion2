import { getConceptGeneratorModelById } from '~/lib/concept-generator-models'

export function resolveProjectPreferredOpenRouterModel (
  projectRow: Record<string, unknown>
): { preferredModelId: string; openrouterModelId: string } {
  const preferredModelId = String(projectRow.preferred_model_id || '').trim() || 'gpt-4o'
  const cfg = getConceptGeneratorModelById(preferredModelId) || getConceptGeneratorModelById('gpt-4o')
  return {
    preferredModelId: cfg?.id || 'gpt-4o',
    openrouterModelId: cfg?.openrouterModelId || 'openai/gpt-4o'
  }
}
