/** Avoid open redirects: only same-origin paths starting with `/`. */
export function safeInternalPath (redirect: unknown, fallback = '/'): string {
  if (typeof redirect !== 'string') return fallback
  const t = redirect.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return fallback
  return t
}
