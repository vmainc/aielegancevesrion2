export interface LegacyAssetPromptRedactionSample {
  assetId: string
  title: string
  kind: string
  fields: string[]
  replacements: string[]
}

export interface LegacyAssetPromptRedactionResult {
  dryRun: boolean
  assetsAffected: number
  fieldsFound: string[]
  fieldCounts: Record<string, number>
  samples: LegacyAssetPromptRedactionSample[]
  replacementDescription: string
  updatedCount: number
  skippedCount: number
  /** After apply — assets that still have full prompt-like values (should be 0). */
  remainingLeakCount: number
  observabilityPreservedCount: number
}
