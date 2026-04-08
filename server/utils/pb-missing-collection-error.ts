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

function fieldErrorsFromMap (fieldMap: Record<string, unknown>): string {
  const parts = Object.entries(fieldMap).map(([k, v]) => {
    if (v && typeof v === 'object' && v !== null && 'message' in v) {
      return `${k}: ${String((v as { message?: string }).message)}`
    }
    return `${k}: ${JSON.stringify(v)}`
  })
  return parts.length ? parts.join('; ') : ''
}

/** Prefer PocketBase validation payload over the generic "Failed to create record." */
export function formatPocketBaseRecordError (e: unknown): string {
  if (!e || typeof e !== 'object') {
    return typeof e === 'string' ? e : String(e)
  }
  const o = e as {
    data?: { data?: Record<string, unknown>; message?: string }
    message?: string
    response?: { data?: { data?: Record<string, unknown>; message?: string } }
  }
  const candidates: Array<Record<string, unknown> | undefined> = [
    o.data?.data,
    o.response?.data?.data
  ]
  for (const fieldMap of candidates) {
    if (fieldMap && typeof fieldMap === 'object' && !Array.isArray(fieldMap)) {
      const line = fieldErrorsFromMap(fieldMap as Record<string, unknown>)
      if (line) return line
    }
  }
  const msgFromData =
    (typeof o.data?.message === 'string' && o.data.message.trim() && o.data.message) ||
    (typeof o.response?.data?.message === 'string' && o.response.data.message.trim() && o.response.data.message)
  if (msgFromData) return msgFromData.trim()
  if (typeof o.message === 'string' && o.message.trim()) {
    return o.message.trim()
  }
  return String(e)
}
