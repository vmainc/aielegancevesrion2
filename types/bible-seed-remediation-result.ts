export interface BibleSeedRemediationSample {
  id: string
  statement: string
  factType: string
  entityId: string
  currentStatus: string
  targetStatus: string
}

export interface BibleSeedRemediationResult {
  dryRun: boolean
  foundCount: number
  updatedCount: number
  skippedCount: number
  targetStatus: string
  samples: BibleSeedRemediationSample[]
}
