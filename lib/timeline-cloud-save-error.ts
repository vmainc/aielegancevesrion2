import { formatApiFetchError } from '~/lib/format-api-fetch-error'

export function getApiFetchStatusCode (e: unknown): number | undefined {
  if (e && typeof e === 'object') {
    const o = e as { statusCode?: number; status?: number }
    const code = o.statusCode ?? o.status
    return typeof code === 'number' ? code : undefined
  }
  return undefined
}

export function isBrowserOffline (): boolean {
  return import.meta.client && typeof navigator !== 'undefined' && !navigator.onLine
}

function isLikelyNetworkFailureMessage (msg: string): boolean {
  const t = msg.trim().toLowerCase()
  if (!t) return false
  return (
    t === 'fetch failed' ||
    t === 'failed to fetch' ||
    /failed to fetch|networkerror|load failed|fetch failed|ecconnrefused|network request failed|aborted/.test(t)
  )
}

export function isLikelyNetworkOrOfflineError (e: unknown): boolean {
  if (isBrowserOffline()) return true

  if (typeof e === 'string') {
    return isLikelyNetworkFailureMessage(e)
  }

  if (e && typeof e === 'object') {
    const o = e as { message?: string; cause?: unknown }
    const msg = typeof o.message === 'string' ? o.message.trim() : ''
    if (msg && isLikelyNetworkFailureMessage(msg)) return true
    if (o.cause) return isLikelyNetworkOrOfflineError(o.cause)
  }

  if (e instanceof Error) {
    return isLikelyNetworkFailureMessage(e.message)
  }

  return false
}

export function isApiFetchAuthError (e: unknown): boolean {
  const status = getApiFetchStatusCode(e)
  return status === 401 || status === 403
}

export function isApiFetchValidationError (e: unknown): boolean {
  const status = getApiFetchStatusCode(e)
  return status === 400 || status === 422
}

export function isApiFetchConflictError (e: unknown): boolean {
  return getApiFetchStatusCode(e) === 409
}

export function isApiFetchServerUnavailableError (e: unknown): boolean {
  const status = getApiFetchStatusCode(e)
  return status === 500 || status === 502 || status === 503 || status === 504
}

/** Whether a failed timeline PUT should be queued for later (PASS 33). */
export function isTimelineCloudSaveQueueableError (e: unknown): boolean {
  if (isApiFetchAuthError(e)) return false
  if (isApiFetchConflictError(e)) return false
  if (isApiFetchValidationError(e)) return false
  if (isLikelyNetworkOrOfflineError(e)) return true
  if (isApiFetchServerUnavailableError(e)) return true
  return false
}

export function timelineCloudSaveQueueErrorMessage (e: unknown, fallback: string): string {
  return formatApiFetchError(e, fallback)
}
