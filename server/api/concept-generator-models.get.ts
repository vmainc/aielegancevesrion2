import { CONCEPT_GENERATOR_MODELS } from '~/lib/concept-generator-models'

/**
 * Public list of models available for concept generation (no secrets).
 */
export default defineEventHandler(() => {
  return {
    models: CONCEPT_GENERATOR_MODELS.map(({ id, label }) => ({ id, label }))
  }
})
