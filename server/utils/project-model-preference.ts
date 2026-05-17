import { getConceptGeneratorModelById } from '~/lib/concept-generator-models'

export function resolveProjectPreferredOpenRouterModel (
  projectRow: Record<string, unknown>
): { preferredModelId: string; openrouterModelId: string } {
  const preferredModelId = String(projectRow.preferred_model_id || '').trim() || 'claude'
  const cfg = getConceptGeneratorModelById(preferredModelId) || getConceptGeneratorModelById('claude')
  return {
    preferredModelId: cfg?.id || 'claude',
    openrouterModelId: cfg?.openrouterModelId || 'anthropic/claude-sonnet-4'
  }
}
