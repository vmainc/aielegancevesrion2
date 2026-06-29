export interface BibleSeedResult {
  dryRun: boolean
  entitiesCreated: number
  entitiesSkippedDuplicate: number
  factsCreated: number
  factsSkippedDuplicate: number
  relationshipsCreated: number
  relationshipsSkippedDuplicate: number
  unsupported: string[]
  created: {
    entities: Array<{ type: string; name: string; status: string }>
    facts: Array<{ entityName: string; statement: string; status: string }>
    relationships: Array<{ summary: string; status: string }>
  }
  skipped: {
    entities: Array<{ type: string; name: string; reason: string }>
    relationships: Array<{ summary: string; reason: string }>
  }
}
