/**
 * PocketBase returns different wordings when a collection is absent or not registered yet,
 * e.g. "Missing or invalid collection context" (note "or invalid") vs older messages.
 * Older code matched only the contiguous phrase "missing collection context" and missed the common case.
 */
export const POCKETBASE_MISSING_COLLECTION_MESSAGE_RE =
  /missing or invalid collection context|missing collection context|wasn't found|not found|missing collection/i

export function pocketBaseErrorMessage (e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message?: string }).message || '')
  }
  return typeof e === 'string' ? e : String(e)
}

export function pocketBaseErrorStatus (e: unknown): number {
  if (e && typeof e === 'object' && 'status' in e) return Number((e as { status?: number }).status || 0)
  if (e && typeof e === 'object' && 'statusCode' in e) return Number((e as { statusCode?: number }).statusCode || 0)
  return 0
}

export function isPocketBaseMissingCollectionError (e: unknown): boolean {
  const msg = pocketBaseErrorMessage(e)
  const status = pocketBaseErrorStatus(e)
  return status === 404 || POCKETBASE_MISSING_COLLECTION_MESSAGE_RE.test(msg)
}
