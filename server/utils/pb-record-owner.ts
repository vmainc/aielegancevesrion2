/**
 * Owner relation on creative_* / project_assets records.
 * PocketBase API rules reject identifiers like `user` / `owner` in some versions; schema uses `owned_by`.
 * Reads fall back to legacy `owner` / `user`.
 */
export function pbRecordOwnerId (record: {
  owned_by?: unknown
  owner?: unknown
  user?: unknown
}): string | undefined {
  const raw = record.owned_by ?? record.owner ?? record.user
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'id' in raw) {
    return String((raw as { id: string }).id)
  }
  return undefined
}
