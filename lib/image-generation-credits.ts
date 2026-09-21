/**
 * Server-authoritative credit / usage hooks for image generation.
 *
 * AI Film Studio does not yet have an in-app credit ledger. OpenRouter account
 * balances and HTTP 402 are the only billing surface today.
 *
 * Configure pricing rules here when app credits are introduced — never trust
 * client-supplied cost or credit values.
 */

export type ImageGenerationUsageCharge = {
  /** Always false until an in-app ledger exists. */
  charged: boolean
  /** OpenRouter-reported cost in USD when available. */
  openRouterCostUsd: number | null
  /** Future: credits deducted from the user wallet. */
  appCreditsCharged: number | null
  /** Where the pricing rule lives once configured. */
  pricingRuleId: 'openrouter_passthrough' | 'app_credit_table'
  note: string
}

export function resolveImageGenerationUsageCharge (options: {
  openRouterCostUsd?: number | null
  imageCount?: number
}): ImageGenerationUsageCharge {
  const openRouterCostUsd =
    typeof options.openRouterCostUsd === 'number' && Number.isFinite(options.openRouterCostUsd)
      ? options.openRouterCostUsd
      : null

  return {
    charged: false,
    openRouterCostUsd,
    appCreditsCharged: null,
    pricingRuleId: 'openrouter_passthrough',
    note:
      'No in-app credit deduction yet. Record OpenRouter cost for reporting; wire app credits via resolveImageGenerationUsageCharge.'
  }
}
