import { readGenerationObservability } from '~/lib/generation-observability'

/** Read the model that generated a library clip (observability first, then legacy fields). */
export function readAssetSourceGenerationModel (
  metadata: Record<string, unknown> | null | undefined
): string {
  if (!metadata || typeof metadata !== 'object') return ''
  const obs = readGenerationObservability(metadata)
  const fromObs = (obs?.model || '').trim()
  if (fromObs) return fromObs
  for (const key of ['model', 'model_id', 'video_model', 'generator_model'] as const) {
    const v = metadata[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** Short human label for prompt + UI (keeps Aleph's 1000-char budget). */
export function formatSourceGenerationModelLabel (modelId: string): string {
  const id = modelId.trim()
  if (!id) return ''
  const lower = id.toLowerCase()
  if (lower.includes('seedance-2.5') || lower.includes('seedance_2.5')) return 'Seedance 2.5'
  if (lower.includes('seedance-2.0') || lower.includes('seedance_2.0') || lower.includes('seedance-2')) {
    return 'Seedance 2.0'
  }
  if (lower.includes('seedance-1') || lower.includes('seedance_1')) return 'Seedance 1.5'
  if (lower.includes('seedance')) return 'Seedance'
  if (lower.includes('aleph')) return 'Runway Aleph'
  if (lower.includes('kling')) return 'Kling'
  if (lower.includes('veo')) return 'Google Veo'
  if (lower.includes('wan')) return 'Wan'
  if (lower.includes('hailuo') || lower.includes('minimax')) return 'MiniMax Hailuo'
  if (lower.includes('luma') || lower.includes('ray-')) return 'Luma'
  // Strip provider prefix for unknown slugs: bytedance/foo -> foo
  const slash = id.lastIndexOf('/')
  return (slash >= 0 ? id.slice(slash + 1) : id).slice(0, 48)
}

/**
 * Compact look-match line for Aleph. Reminds the editor to preserve Seedance (etc.)
 * lighting/grade while applying only the named fix.
 */
export function sourceLookMatchPromptLine (modelId: string): string {
  const label = formatSourceGenerationModelLabel(modelId)
  if (!label) return ''
  return `Source look: originally generated with ${label}. Match that model's lighting, color grade, texture, sharpness, and overall composition; change only the named problem.`
}
