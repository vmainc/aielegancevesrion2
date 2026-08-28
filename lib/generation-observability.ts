import { productionBibleGenerationDebugLabel } from '~/lib/production-bible-generation-context'
import type { ProductionBibleResolvedContext } from '~/types/production-bible-context'

/** Nested under `project_assets.metadata` — provenance only; no full prompts. */
export const GENERATION_OBSERVABILITY_METADATA_KEY = 'generation_observability'

/** Canonical generation path slugs (PASS 22–23). */
export const GENERATION_PATH = {
  STORYBOARD_FRAME: 'storyboard_frame',
  CHARACTER_CREATOR: 'character_creator',
  VIDEO_GENERATION: 'video_generation',
  PROJECT_VIDEO_PANEL: 'project_video_panel',
  GENERATE_CHARACTER_API: 'generate_character_api',
  VIDEO_REPAIR: 'video_repair'
} as const

export type GenerationPath = typeof GENERATION_PATH[keyof typeof GENERATION_PATH]

/** Keys that must never appear inside `generation_observability` (prompt leak guard). */
export const GENERATION_OBSERVABILITY_FORBIDDEN_KEYS = [
  'prompt',
  'prompt_used',
  'promptUsed',
  'fullPrompt',
  'userPrompt',
  'negativePrompt',
  'negative_prompt',
  'dialogue',
  'dialogue_line',
  'ambient_sound_prompt',
  'imagePrompt',
  'videoPrompt'
] as const

const PROMPT_HASH_PATTERN = /^djb2:[0-9a-f]{1,16}$/i
const MAX_DEBUG_LABEL_CHARS = 240

/** Lightweight provenance stamped when saving generated assets (PASS 22). */
export interface GenerationObservabilityRecord {
  projectId?: string
  sceneId?: string
  shotId?: string
  characterId?: string
  characterIds?: string[]
  assetId?: string
  generationPath: GenerationPath | string
  model?: string
  provider?: string
  /** Hash of the prompt sent to the provider — full text is not stored. */
  promptHash?: string
  bibleContextUsed: boolean
  bibleEntityIds?: string[]
  bibleFactIds?: string[]
  bibleRelationshipIds?: string[]
  bibleEntityCount?: number
  bibleFactCount?: number
  bibleRelationshipCount?: number
  bibleDebugLabel?: string
  failOpenReason?: string
  createdAt: string
}

export interface BuildGenerationObservabilityInput {
  generationPath: GenerationPath | string
  projectId?: string
  sceneId?: string
  shotId?: string
  characterId?: string
  characterIds?: string[]
  assetId?: string
  model?: string
  provider?: string
  promptForHash?: string
  bibleContext?: ProductionBibleResolvedContext | null
  failOpenReason?: string
  createdAt?: string
}

export function hashPromptForObservability (prompt: string): string {
  const s = prompt.trim()
  if (!s) return ''
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
  }
  return `djb2:${(h >>> 0).toString(16)}`
}

function bibleContextWasUsed (ctx: ProductionBibleResolvedContext | null | undefined): boolean {
  if (!ctx) return false
  return Boolean(ctx.entities.length || ctx.facts.length || ctx.relationships.length)
}

function normalizePromptHash (value: string | undefined): string | undefined {
  if (!value) return undefined
  const v = value.trim()
  if (!v || !PROMPT_HASH_PATTERN.test(v)) return undefined
  return v.toLowerCase()
}

function normalizeDebugLabel (value: string | undefined): string | undefined {
  if (!value) return undefined
  const v = value.trim()
  if (!v) return undefined
  return v.slice(0, MAX_DEBUG_LABEL_CHARS)
}

/** Strip forbidden keys and normalize fields — safe for persistence and display. */
export function sanitizeGenerationObservabilityRecord (
  record: GenerationObservabilityRecord
): GenerationObservabilityRecord {
  const path = typeof record.generationPath === 'string' ? record.generationPath.trim() : ''
  if (!path) {
    throw new Error('generationPath is required for observability records')
  }
  const used = record.bibleContextUsed === true
  return {
    projectId: record.projectId?.trim() || undefined,
    sceneId: record.sceneId?.trim() || undefined,
    shotId: record.shotId?.trim() || undefined,
    characterId: record.characterId?.trim() || undefined,
    characterIds: record.characterIds?.length ? [...record.characterIds] : undefined,
    assetId: record.assetId?.trim() || undefined,
    generationPath: path,
    model: record.model?.trim() || undefined,
    provider: record.provider?.trim() || undefined,
    promptHash: normalizePromptHash(record.promptHash),
    bibleContextUsed: used,
    bibleEntityIds: used && record.bibleEntityIds?.length ? [...record.bibleEntityIds] : undefined,
    bibleFactIds: used && record.bibleFactIds?.length ? [...record.bibleFactIds] : undefined,
    bibleRelationshipIds: used && record.bibleRelationshipIds?.length
      ? [...record.bibleRelationshipIds]
      : undefined,
    bibleEntityCount: used ? (record.bibleEntityCount ?? record.bibleEntityIds?.length ?? 0) : 0,
    bibleFactCount: used ? (record.bibleFactCount ?? record.bibleFactIds?.length ?? 0) : 0,
    bibleRelationshipCount: used
      ? (record.bibleRelationshipCount ?? record.bibleRelationshipIds?.length ?? 0)
      : 0,
    bibleDebugLabel: normalizeDebugLabel(record.bibleDebugLabel),
    failOpenReason: !used ? record.failOpenReason?.trim() || undefined : undefined,
    createdAt: record.createdAt?.trim() || ''
  }
}

export function observabilityRecordHasForbiddenPromptFields (
  raw: Record<string, unknown>
): boolean {
  for (const key of GENERATION_OBSERVABILITY_FORBIDDEN_KEYS) {
    const v = raw[key]
    if (typeof v === 'string' && v.trim()) return true
  }
  return false
}

export function buildGenerationObservability (
  input: BuildGenerationObservabilityInput
): GenerationObservabilityRecord {
  const ctx = input.bibleContext
  const used = bibleContextWasUsed(ctx)
  const characterIds = [
    ...new Set([
      ...(input.characterIds || []),
      ...(input.characterId ? [input.characterId] : [])
    ].filter(Boolean))
  ]

  return sanitizeGenerationObservabilityRecord({
    projectId: input.projectId?.trim() || undefined,
    sceneId: input.sceneId?.trim() || undefined,
    shotId: input.shotId?.trim() || undefined,
    characterId: input.characterId?.trim() || characterIds[0],
    characterIds: characterIds.length ? characterIds : undefined,
    assetId: input.assetId?.trim() || undefined,
    generationPath: input.generationPath,
    model: input.model?.trim() || undefined,
    provider: input.provider?.trim() || undefined,
    promptHash: input.promptForHash ? hashPromptForObservability(input.promptForHash) : undefined,
    bibleContextUsed: used,
    bibleEntityIds: used ? ctx!.entities.map((e) => e.id) : undefined,
    bibleFactIds: used ? ctx!.facts.map((f) => f.id) : undefined,
    bibleRelationshipIds: used ? ctx!.relationships.map((r) => r.id) : undefined,
    bibleEntityCount: used ? ctx!.entities.length : 0,
    bibleFactCount: used ? ctx!.facts.length : 0,
    bibleRelationshipCount: used ? ctx!.relationships.length : 0,
    bibleDebugLabel: productionBibleGenerationDebugLabel(ctx, input.failOpenReason),
    failOpenReason: input.failOpenReason?.trim() || undefined,
    createdAt: input.createdAt || new Date().toISOString()
  })
}

export function readGenerationObservability (
  metadata: Record<string, unknown> | null | undefined
): GenerationObservabilityRecord | null {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = metadata[GENERATION_OBSERVABILITY_METADATA_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (observabilityRecordHasForbiddenPromptFields(r)) return null
  const path = typeof r.generationPath === 'string' ? r.generationPath.trim() : ''
  if (!path) return null
  const readIds = (v: unknown): string[] | undefined =>
    Array.isArray(v)
      ? v.filter((id): id is string => typeof id === 'string' && id.trim()).map((id) => id.trim())
      : undefined
  const readCount = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : undefined
  try {
    return sanitizeGenerationObservabilityRecord({
      projectId: typeof r.projectId === 'string' ? r.projectId : undefined,
      sceneId: typeof r.sceneId === 'string' ? r.sceneId : undefined,
      shotId: typeof r.shotId === 'string' ? r.shotId : undefined,
      characterId: typeof r.characterId === 'string' ? r.characterId : undefined,
      characterIds: readIds(r.characterIds),
      assetId: typeof r.assetId === 'string' ? r.assetId : undefined,
      generationPath: path,
      model: typeof r.model === 'string' ? r.model : undefined,
      provider: typeof r.provider === 'string' ? r.provider : undefined,
      promptHash: typeof r.promptHash === 'string' ? r.promptHash : undefined,
      bibleContextUsed: r.bibleContextUsed === true,
      bibleEntityIds: readIds(r.bibleEntityIds),
      bibleFactIds: readIds(r.bibleFactIds),
      bibleRelationshipIds: readIds(r.bibleRelationshipIds),
      bibleEntityCount: readCount(r.bibleEntityCount),
      bibleFactCount: readCount(r.bibleFactCount),
      bibleRelationshipCount: readCount(r.bibleRelationshipCount),
      bibleDebugLabel: typeof r.bibleDebugLabel === 'string' ? r.bibleDebugLabel : undefined,
      failOpenReason: typeof r.failOpenReason === 'string' ? r.failOpenReason : undefined,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : ''
    })
  } catch {
    return null
  }
}

export function mergeGenerationObservabilityIntoMetadata (
  metadata: Record<string, unknown>,
  record: GenerationObservabilityRecord
): Record<string, unknown> {
  return {
    ...metadata,
    [GENERATION_OBSERVABILITY_METADATA_KEY]: sanitizeGenerationObservabilityRecord(record)
  }
}

export const GENERATION_PATH_LABELS: Record<GenerationPath, string> = {
  [GENERATION_PATH.STORYBOARD_FRAME]: 'Storyboard frame',
  [GENERATION_PATH.CHARACTER_CREATOR]: 'Character Creator',
  [GENERATION_PATH.VIDEO_GENERATION]: 'Video generation',
  [GENERATION_PATH.PROJECT_VIDEO_PANEL]: 'Project video panel',
  [GENERATION_PATH.GENERATE_CHARACTER_API]: 'Generate character API',
  [GENERATION_PATH.VIDEO_REPAIR]: 'Fix Shot'
}

export function generationPathDisplayLabel (path: string): string {
  const labels = GENERATION_PATH_LABELS as Record<string, string>
  if (labels[path]) return labels[path]
  return path.replace(/_/g, ' ')
}

export function formatGenerationObservabilitySummary (record: GenerationObservabilityRecord): string {
  const parts: string[] = []
  parts.push(record.bibleContextUsed ? 'Bible context used' : 'No Bible context')
  if (record.bibleContextUsed) {
    const ec = record.bibleEntityCount ?? record.bibleEntityIds?.length ?? 0
    const fc = record.bibleFactCount ?? record.bibleFactIds?.length ?? 0
    const rc = record.bibleRelationshipCount ?? record.bibleRelationshipIds?.length ?? 0
    parts.push(`${ec} ent · ${fc} facts · ${rc} rel`)
  } else if (record.failOpenReason) {
    parts.push(`unavailable (${record.failOpenReason})`)
  }
  if (record.generationPath) {
    parts.push(generationPathDisplayLabel(record.generationPath))
  }
  return parts.join(' · ')
}

/** UI line for related assets — observability first; legacy generated assets without leaking prompts. */
export function formatAssetProvenanceLine (
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const obs = readGenerationObservability(metadata)
  if (obs) return formatGenerationObservabilitySummary(obs)
  if (!metadata || typeof metadata !== 'object') return null
  const hasLegacyPrompt =
    typeof metadata.prompt_used === 'string' && metadata.prompt_used.trim().length > 0
  const hasModel =
    (typeof metadata.model === 'string' && metadata.model.trim()) ||
    (typeof metadata.model_id === 'string' && metadata.model_id.trim())
  if (hasLegacyPrompt || hasModel) {
    return 'Legacy generated asset (no observability stamp)'
  }
  return null
}
