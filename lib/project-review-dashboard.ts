import { BIBLE_ASSET_ENTITY_METADATA_KEY } from '~/lib/bible-cast-asset-bridge'
import { buildTentativeReviewItems } from '~/lib/bible-tentative-item-filters'
import {
  isBibleFactPendingReview,
  isExcludedBibleStatus
} from '~/lib/bible-trust'
import { readGenerationObservability } from '~/lib/generation-observability'
import { metadataHasFullPromptLeak } from '~/lib/legacy-asset-prompt-metadata'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleFact } from '~/types/bible-fact'
import type { BibleRelationship } from '~/types/bible-relationship'
import type { ProjectAsset } from '~/types/project-asset'

/** Assets with observability or legacy generation markers in the last N days. */
export const RECENT_GENERATED_ASSET_DAYS = 30

export interface ProjectReviewBibleCounts {
  factsPendingReview: number
  tentativeEntities: number
  tentativeRelationships: number
  retiredOrContradicted: number
}

export interface ProjectReviewAssetCounts {
  withObservability: number
  withoutObservability: number
  legacyPromptMetadata: number
  linkedToBibleEntities: number
  totalAssets: number
}

export interface ProjectReviewGenerationCounts {
  recentGeneratedAssets: number
  bibleContextUsed: number
  noBibleContext: number
  observabilityStamped: number
}

export interface ProjectReviewDashboardCounts {
  bible: ProjectReviewBibleCounts
  assets: ProjectReviewAssetCounts
  generation: ProjectReviewGenerationCounts
}

export interface ProjectReviewDashboardInput {
  facts: BibleFact[]
  entities: BibleEntity[]
  relationships: BibleRelationship[]
  assets: ProjectAsset[]
}

function assetMetadata (asset: ProjectAsset): Record<string, unknown> {
  return asset.metadata && typeof asset.metadata === 'object'
    ? asset.metadata
    : {}
}

function assetHasBibleEntityLink (asset: ProjectAsset): boolean {
  const meta = assetMetadata(asset)
  const id = meta[BIBLE_ASSET_ENTITY_METADATA_KEY]
  return typeof id === 'string' && id.trim().length > 0
}

export function isLikelyGeneratedAsset (asset: ProjectAsset): boolean {
  if (readGenerationObservability(asset.metadata)) return true
  if (metadataHasFullPromptLeak(asset.metadata)) return true
  const meta = assetMetadata(asset)
  if (typeof meta.model === 'string' && meta.model.trim()) return true
  if (typeof meta.model_id === 'string' && meta.model_id.trim()) return true
  if (asset.kind === 'video' || asset.kind === 'storyboard' || asset.kind === 'character') {
    return Boolean(asset.fileUrl)
  }
  return false
}

function isRecentGeneratedAsset (
  asset: ProjectAsset,
  observabilityCreatedAt?: string
): boolean {
  const cutoff = Date.now() - RECENT_GENERATED_ASSET_DAYS * 24 * 60 * 60 * 1000
  const candidates = [asset.created, asset.updated, observabilityCreatedAt].filter(Boolean)
  for (const iso of candidates) {
    const t = Date.parse(iso as string)
    if (!Number.isNaN(t) && t >= cutoff) return true
  }
  return false
}

export function computeProjectReviewDashboard (
  input: ProjectReviewDashboardInput
): ProjectReviewDashboardCounts {
  const factsPendingReview = input.facts.filter((f) => isBibleFactPendingReview(f.status)).length

  const tentativeItems = buildTentativeReviewItems(input.entities, input.relationships)
  const tentativeEntityCount = tentativeItems.filter((i) => i.kind === 'entity').length
  const tentativeRelationshipCount = tentativeItems.filter((i) => i.kind === 'relationship').length

  const retiredOrContradicted =
    input.facts.filter((f) => isExcludedBibleStatus(f.status)).length +
    input.entities.filter((e) => isExcludedBibleStatus(e.status)).length +
    input.relationships.filter((r) => isExcludedBibleStatus(r.status)).length

  let withObservability = 0
  let withoutObservability = 0
  let legacyPromptMetadata = 0
  let linkedToBibleEntities = 0
  let bibleContextUsed = 0
  let noBibleContext = 0
  let recentGeneratedAssets = 0

  for (const asset of input.assets) {
    const obs = readGenerationObservability(asset.metadata)
    if (obs) {
      withObservability++
      if (obs.bibleContextUsed) bibleContextUsed++
      else noBibleContext++
      if (isRecentGeneratedAsset(asset, obs.createdAt)) recentGeneratedAssets++
    } else if (isLikelyGeneratedAsset(asset)) {
      withoutObservability++
      if (isRecentGeneratedAsset(asset)) recentGeneratedAssets++
    }
    if (metadataHasFullPromptLeak(asset.metadata)) legacyPromptMetadata++
    if (assetHasBibleEntityLink(asset)) linkedToBibleEntities++
  }

  return {
    bible: {
      factsPendingReview,
      tentativeEntities: tentativeEntityCount,
      tentativeRelationships: tentativeRelationshipCount,
      retiredOrContradicted
    },
    assets: {
      withObservability,
      withoutObservability,
      legacyPromptMetadata,
      linkedToBibleEntities,
      totalAssets: input.assets.length
    },
    generation: {
      recentGeneratedAssets,
      bibleContextUsed,
      noBibleContext,
      observabilityStamped: withObservability
    }
  }
}
