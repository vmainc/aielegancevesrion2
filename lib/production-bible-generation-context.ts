import {
  formatProductionBibleDebugLabel,
  formatProductionBiblePromptBlock
} from '~/lib/format-production-bible-prompt-block'
import type {
  ProductionBibleResolvedContext,
  ResolveProductionBibleContextOptions
} from '~/types/production-bible-context'

/** Shared resolver budgets for all generation prompt paths (PASS 19). */
export const PRODUCTION_BIBLE_GENERATION_MAX_ITEMS = 20
export const PRODUCTION_BIBLE_GENERATION_TOKEN_BUDGET = 1400

export const DEFAULT_PRODUCTION_BIBLE_GENERATION_OPTIONS: ResolveProductionBibleContextOptions = {
  maxItems: PRODUCTION_BIBLE_GENERATION_MAX_ITEMS,
  tokenBudget: PRODUCTION_BIBLE_GENERATION_TOKEN_BUDGET
}

export function mergeProductionBibleGenerationOptions (
  options: ResolveProductionBibleContextOptions = {}
): ResolveProductionBibleContextOptions {
  return { ...DEFAULT_PRODUCTION_BIBLE_GENERATION_OPTIONS, ...options }
}

/** Low-risk debug metadata for generation UIs and optional API fields. */
export interface ProductionBibleGenerationDebug {
  label: string
  entitiesIncluded: number
  factsIncluded: number
  relationshipsIncluded: number
  estimatedChars: number
  failOpenReason?: string
  includedEntityNames?: string[]
  includedFactStatements?: string[]
  includedRelationshipSummaries?: string[]
}

/** Canonical short label for every generation integration (PASS 19). */
export function productionBibleGenerationDebugLabel (
  ctx: ProductionBibleResolvedContext | null | undefined,
  failOpenReason?: string
): string {
  if (failOpenReason) {
    return `Production Bible unavailable (${failOpenReason})`
  }
  if (!ctx) return 'Production Bible context unavailable'
  return formatProductionBibleDebugLabel(ctx)
}

export function appendProductionBibleToPrompt (
  userPrompt: string,
  ctx: ProductionBibleResolvedContext | null | undefined
): string {
  const base = userPrompt.trim()
  const block = formatProductionBiblePromptBlock(ctx)
  if (!block.trim()) return base
  return `${base}\n\n${block}`.trim()
}

export function buildProductionBibleGenerationDebug (
  ctx: ProductionBibleResolvedContext | null | undefined,
  failOpenReason?: string
): ProductionBibleGenerationDebug | undefined {
  const label = productionBibleGenerationDebugLabel(ctx, failOpenReason)
  if (!ctx && !failOpenReason) return undefined
  const d = ctx?.debug
  return {
    label,
    entitiesIncluded: d?.entitiesIncluded ?? 0,
    factsIncluded: d?.factsIncluded ?? 0,
    relationshipsIncluded: d?.relationshipsIncluded ?? 0,
    estimatedChars: d?.estimatedChars ?? 0,
    failOpenReason,
    includedEntityNames: ctx?.entities.map((e) => e.name).slice(0, 12),
    includedFactStatements: ctx?.facts.map((f) => f.statement.slice(0, 120)).slice(0, 8),
    includedRelationshipSummaries: ctx?.relationships.map((r) => r.summary).slice(0, 8)
  }
}
