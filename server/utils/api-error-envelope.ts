import { createError } from 'h3'

/**
 * Stable machine-readable codes for clients ($fetch error.data) and logs.
 * Human copy stays in `error.message`.
 */
export const ApiErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  SCRIPT_ASSET_NOT_FOUND: 'SCRIPT_ASSET_NOT_FOUND',
  SCRIPT_ASSET_WRONG_PROJECT: 'SCRIPT_ASSET_WRONG_PROJECT',
  SCENE_WRONG_PROJECT: 'SCENE_WRONG_PROJECT',
  MISSING_COLLECTION: 'MISSING_COLLECTION',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  OPENROUTER_TIMEOUT: 'OPENROUTER_TIMEOUT',
  OPENROUTER_UPSTREAM: 'OPENROUTER_UPSTREAM',
  OPENROUTER_NOT_CONFIGURED: 'OPENROUTER_NOT_CONFIGURED',
  BAD_GATEWAY: 'BAD_GATEWAY'
} as const

export type ApiErrorCodeType = (typeof ApiErrorCode)[keyof typeof ApiErrorCode]

export type ApiErrorEnvelope = {
  ok: false
  error: {
    code: ApiErrorCodeType
    message: string
    details?: Record<string, unknown>
  }
}

export function throwApiError (
  statusCode: number,
  code: ApiErrorCodeType,
  message: string,
  details?: Record<string, unknown>
): never {
  const error: ApiErrorEnvelope['error'] = {
    code,
    message,
    ...(details && Object.keys(details).length ? { details } : {})
  }
  const envelope: ApiErrorEnvelope = { ok: false, error }
  throw createError({
    statusCode,
    statusMessage: message.slice(0, 500),
    message,
    data: envelope
  })
}

export function isAbortLikeError (e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as { name?: string; cause?: unknown; message?: string }
  if (o.name === 'AbortError') return true
  const msg = typeof o.message === 'string' ? o.message.toLowerCase() : ''
  if (msg.includes('aborted') || msg.includes('abort')) return true
  if (o.cause) return isAbortLikeError(o.cause)
  return false
}
