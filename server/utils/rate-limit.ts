import { createError } from 'h3'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Simple in-memory rate limiter for expensive API routes (per-process).
 * Returns remaining requests in the current window.
 */
export function checkRateLimit (
  key: string,
  maxRequests: number,
  windowMs: number
): number {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return maxRequests - 1
  }
  existing.count += 1
  if (existing.count > maxRequests) {
    throw createError({
      statusCode: 429,
      message: 'Too many requests. Please wait a moment and try again.'
    })
  }
  return Math.max(0, maxRequests - existing.count)
}

/** Build a stable rate-limit key from user id and route name. */
export function rateLimitKey (userId: string, route: string): string {
  return `${route}:${userId}`
}
