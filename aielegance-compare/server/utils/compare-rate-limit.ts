type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function clientKey (event: { node?: { req?: { headers?: Record<string, unknown>; socket?: { remoteAddress?: string } } } }): string {
  const headers = event.node?.req?.headers || {}
  const forwarded = headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim()
  }
  return event.node?.req?.socket?.remoteAddress || 'unknown'
}

export function allowRequest (key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const cur = buckets.get(key)
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (cur.count >= max) return false
  cur.count += 1
  return true
}
