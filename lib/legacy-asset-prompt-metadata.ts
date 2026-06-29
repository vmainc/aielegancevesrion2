import {
  GENERATION_OBSERVABILITY_METADATA_KEY,
  hashPromptForObservability
} from '~/lib/generation-observability'

/** Top-level `project_assets.metadata` keys that may store full prompt text (PASS 24 audit). */
export const LEGACY_ASSET_PROMPT_METADATA_KEYS = [
  'prompt_used',
  'prompt',
  'negative_prompt',
  'dialogue_line',
  'ambient_sound_prompt',
  'image_prompt',
  'video_prompt',
  'promptUsed',
  'fullPrompt',
  'userPrompt',
  'negativePrompt',
  'dialogue',
  'imagePrompt',
  'videoPrompt'
] as const

export type LegacyAssetPromptMetadataKey = typeof LEGACY_ASSET_PROMPT_METADATA_KEYS[number]

export const REDACTED_PROMPT_MARKER = '[redacted]'

export const LEGACY_PROMPT_REDACTION_REPLACEMENT =
  'Full prompt text → `[redacted]` plus `{field}_hash` (djb2) when a hash can be computed'

const PROMPT_HASH_PATTERN = /^djb2:[0-9a-f]{1,16}$/i

export function isAlreadyRedactedPromptValue (value: unknown): boolean {
  if (typeof value !== 'string') return true
  const s = value.trim()
  if (!s) return true
  if (s === REDACTED_PROMPT_MARKER) return true
  if (PROMPT_HASH_PATTERN.test(s)) return true
  return false
}

export function legacyPromptFieldNeedsRedaction (value: unknown): boolean {
  if (typeof value !== 'string') return false
  const s = value.trim()
  if (!s) return false
  return !isAlreadyRedactedPromptValue(s)
}

/** Scan top-level metadata only — never inspects `generation_observability`. */
export function scanLegacyPromptFields (
  metadata: Record<string, unknown> | null | undefined
): LegacyAssetPromptMetadataKey[] {
  if (!metadata || typeof metadata !== 'object') return []
  const found: LegacyAssetPromptMetadataKey[] = []
  for (const key of LEGACY_ASSET_PROMPT_METADATA_KEYS) {
    if (legacyPromptFieldNeedsRedaction(metadata[key])) {
      found.push(key)
    }
  }
  return found
}

export function metadataHasFullPromptLeak (
  metadata: Record<string, unknown> | null | undefined
): boolean {
  return scanLegacyPromptFields(metadata).length > 0
}

export function redactLegacyPromptMetadata (
  metadata: Record<string, unknown>
): { metadata: Record<string, unknown>; fieldsRedacted: string[] } {
  const observability = metadata[GENERATION_OBSERVABILITY_METADATA_KEY]
  const next: Record<string, unknown> = { ...metadata }
  const fieldsRedacted: string[] = []

  for (const key of LEGACY_ASSET_PROMPT_METADATA_KEYS) {
    const val = next[key]
    if (!legacyPromptFieldNeedsRedaction(val)) continue
    const hash = hashPromptForObservability(String(val))
    if (hash) next[`${key}_hash`] = hash
    next[key] = REDACTED_PROMPT_MARKER
    fieldsRedacted.push(key)
  }

  if (observability !== undefined) {
    next[GENERATION_OBSERVABILITY_METADATA_KEY] = observability
  }

  if (fieldsRedacted.length) {
    next.legacy_prompt_redacted_at = new Date().toISOString()
  }

  return { metadata: next, fieldsRedacted }
}
