/**
 * OpenRouter model IDs for Adapt to Film operations.
 * Override via env without hard-coding in call sites.
 */

function envModel (...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]
    if (v && String(v).trim()) return String(v).trim()
  }
  return undefined
}

const DEFAULT_TREATMENT =
  envModel('NUXT_OPENROUTER_ADAPT_TREATMENT_MODEL', 'OPENROUTER_ADAPT_TREATMENT_MODEL') ||
  envModel('NUXT_OPENROUTER_STORY_MODEL', 'OPENROUTER_STORY_MODEL') ||
  'openai/gpt-4o-mini'

const DEFAULT_SCENES =
  envModel('NUXT_OPENROUTER_ADAPT_SCENES_MODEL', 'OPENROUTER_ADAPT_SCENES_MODEL') ||
  DEFAULT_TREATMENT

const DEFAULT_SHOTS =
  envModel('NUXT_OPENROUTER_ADAPT_SHOTS_MODEL', 'OPENROUTER_ADAPT_SHOTS_MODEL') ||
  DEFAULT_TREATMENT

export function adaptTreatmentModelId (): string {
  return DEFAULT_TREATMENT
}

export function adaptScenesModelId (): string {
  return DEFAULT_SCENES
}

export function adaptShotsModelId (): string {
  return DEFAULT_SHOTS
}

export type AdaptModelRole = 'treatment' | 'scenes' | 'shots'

export function adaptModelForRole (role: AdaptModelRole): string {
  if (role === 'scenes') return adaptScenesModelId()
  if (role === 'shots') return adaptShotsModelId()
  return adaptTreatmentModelId()
}
