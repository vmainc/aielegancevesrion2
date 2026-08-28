import { visualRepairCategories, type RepairCategoryId } from './categories'
import type { RepairEngineChoice, VideoRepairProviderId } from './types'

export type RepairEngineRecommendation = {
  provider: VideoRepairProviderId
  model: string
  /** Why this engine was chosen — for logs, not the UI. */
  reason: string
}

export type RepairRoutingConfig = {
  defaultProvider: VideoRepairProviderId
  defaultModel: string
  lumaConfigured: boolean
  lumaModel: string
}

/**
 * Map a user engine choice to a provider + model.
 *
 * AUTO currently always uses the configured default. The category argument is
 * reserved so we can later route face/identity vs environment vs object vs voice
 * without changing callers.
 */
export function resolveRepairEngine (opts: {
  choice: RepairEngineChoice
  categories: RepairCategoryId[]
  config: RepairRoutingConfig
}): RepairEngineRecommendation {
  const { choice, categories, config } = opts
  const visual = visualRepairCategories(categories)

  if (choice === 'luma') {
    if (!config.lumaConfigured) {
      return {
        provider: config.defaultProvider,
        model: config.defaultModel,
        reason: 'luma_requested_but_unconfigured'
      }
    }
    return {
      provider: 'luma',
      model: config.lumaModel,
      reason: 'user_luma'
    }
  }

  if (choice === 'openrouter') {
    return {
      provider: 'openrouter',
      model: config.defaultProvider === 'openrouter' ? config.defaultModel : config.defaultModel,
      reason: 'user_openrouter'
    }
  }

  // AUTO — keep this branch simple on purpose. Future:
  //   face / identity  → provider X
  //   environment      → provider Y
  //   object / prop    → provider Z
  //   voice            → audio pipeline (not this engine)
  void visual
  if (config.defaultProvider === 'luma' && config.lumaConfigured) {
    return {
      provider: 'luma',
      model: config.lumaModel,
      reason: 'auto_default_luma'
    }
  }
  return {
    provider: 'openrouter',
    model: config.defaultModel,
    reason: 'auto_default_openrouter'
  }
}

export function openRouterModelForUserChoice (
  choice: RepairEngineChoice,
  config: RepairRoutingConfig
): string {
  if (choice === 'openrouter' || choice === 'auto') return config.defaultModel
  return config.defaultModel
}
