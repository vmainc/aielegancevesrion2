/**
 * Map $fetch / ofetch failures to readable copy (avoids raw "fetch failed" in UI).
 * Note: `data.message` from APIs sometimes echoes the same generic strings as the client.
 */
export function formatApiFetchError (e: unknown, fallback: string): string {
  const networkHint =
    'Cannot reach the server. Check that the app is running and PocketBase is available (e.g. http://127.0.0.1:8090).'

  if (typeof e === 'string') {
    const t = e.trim()
    return t && !isLikelyNetworkFailureMessage(t) ? t : networkHint
  }

  if (e && typeof e === 'object') {
    const o = e as {
      data?: unknown
      message?: string
      statusMessage?: string
      statusCode?: number
      status?: number
      cause?: unknown
    }

    const fromData = pickMessageFromData(o.data) ||
      (typeof o.statusMessage === 'string' ? o.statusMessage : '')

    if (fromData.trim()) {
      const s = sanitizeApiMessage(fromData.trim(), networkHint)
      if (s) return s
    }

    const msg = typeof o.message === 'string' ? o.message.trim() : ''
    if (msg) {
      if (isLikelyNetworkFailureMessage(msg)) return networkHint
      return msg
    }

    // ofetch sometimes puts the useful bit on `cause`
    if (o.cause) {
      const inner = formatApiFetchError(o.cause, '')
      if (inner) return inner
    }
  }

  if (e instanceof Error) {
    const msg = e.message || ''
    if (isLikelyNetworkFailureMessage(msg)) return networkHint
    if (msg) return msg
  }
  return fallback
}

function pickMessageFromData (data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const d = data as Record<string, unknown>
  const m = d.message
  if (typeof m === 'string') return m
  const nested = d.error
  if (nested && typeof nested === 'object') {
    const em = (nested as { message?: string }).message
    if (typeof em === 'string') return em
  }
  return ''
}

/** Strip useless one-word proxy errors; keep real API messages (e.g. PocketBase 503 hints from Nitro). */
function sanitizeApiMessage (msg: string, networkHint: string): string {
  if (msg.length > 80 && /PocketBase|POCKETBASE_INTERNAL|127\.0\.0\.1:8090|\/pb\b/i.test(msg)) {
    return msg
  }
  if (isLikelyNetworkFailureMessage(msg)) return networkHint
  return msg
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
