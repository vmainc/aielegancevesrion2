/**
 * Map PocketBase / network failures to short, user-facing copy.
 * Never surface raw SDK payloads in the UI.
 */

type PbFieldError = { code?: string; message?: string }

function asRecord (value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function fieldErrorsFrom (error: unknown): Record<string, PbFieldError> {
  const err = asRecord(error)
  if (!err) return {}
  const response = asRecord(err.response)
  const candidates = [asRecord(response?.data), asRecord(err.data), response, err]
  const out: Record<string, PbFieldError> = {}
  for (const candidate of candidates) {
    if (!candidate) continue
    const source = asRecord(candidate.data) || candidate
    for (const [key, value] of Object.entries(source)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const v = value as PbFieldError
      if (!v.code && !v.message) continue
      out[key] = { code: v.code, message: v.message }
    }
    if (Object.keys(out).length) return out
  }
  return out
}

function statusFrom (error: unknown): number {
  const err = asRecord(error)
  if (!err) return 0
  const n = err.status ?? err.statusCode
  return typeof n === 'number' ? n : 0
}

function isNetworkError (error: unknown): boolean {
  const err = asRecord(error)
  const orig = asRecord(err?.originalError) || asRecord(err?.cause)
  const msg = String(err?.message || orig?.message || '')
  const name = String(orig?.name || err?.name || '')
  return (
    name === 'TypeError' ||
    /failed to fetch|networkerror|load failed|fetch failed|econnrefused/i.test(msg) ||
    (statusFrom(error) === 0 && !asRecord(err?.response)?.data)
  )
}

function hasUniqueEmailError (fields: Record<string, PbFieldError>): boolean {
  const email = fields.email
  if (!email) return false
  const code = String(email.code || '').toLowerCase()
  const message = String(email.message || '').toLowerCase()
  return (
    code.includes('unique') ||
    message.includes('already') ||
    message.includes('unique') ||
    message.includes('exists')
  )
}

export function friendlyLoginError (error: unknown): string {
  if (isNetworkError(error)) {
    return 'Cannot reach the server. Check your connection and try again.'
  }
  const status = statusFrom(error)
  if (status === 400 || status === 401 || status === 403) {
    return 'Email or password is incorrect.'
  }
  return 'Email or password is incorrect.'
}

export function friendlyRegisterError (error: unknown): string {
  if (isNetworkError(error)) {
    return 'Cannot reach the server. Check your connection and try again.'
  }
  const fields = fieldErrorsFrom(error)
  if (hasUniqueEmailError(fields)) {
    return 'That email is already registered.'
  }
  if (fields.password?.message || fields.passwordConfirm?.message) {
    const msg = String(fields.password?.message || fields.passwordConfirm?.message || '').toLowerCase()
    if (msg.includes('match')) return 'Passwords do not match.'
    if (msg.includes('length') || msg.includes('8')) {
      return 'Password must be at least 8 characters.'
    }
    return 'Please choose a stronger password (at least 8 characters).'
  }
  if (fields.email?.message) {
    return 'Please enter a valid email address.'
  }
  if (fields.name?.message) {
    return 'Please enter your name.'
  }
  const status = statusFrom(error)
  if (status === 400) {
    return 'Please check your details and try again.'
  }
  return 'Could not create your account. Please try again.'
}

export function friendlyPasswordResetError (error: unknown): string {
  if (isNetworkError(error)) {
    return 'Cannot reach the server. Check your connection and try again.'
  }
  return 'Failed to reset password. The link may be invalid or expired.'
}

export function friendlyProfileError (error: unknown): string {
  if (isNetworkError(error)) {
    return 'Cannot reach the server. Check your connection and try again.'
  }
  const status = statusFrom(error)
  if (status === 401 || status === 404) {
    return 'Your session expired. Log out, then log in again.'
  }
  return 'Could not update your profile. Please try again.'
}
