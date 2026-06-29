/** PocketBase user JWT for Nuxt API routes that call `getPocketBaseUserIdFromRequest`. */
export function pocketBaseBearerHeaders (token: string | null | undefined): Record<string, string> {
  const t = typeof token === 'string' ? token.trim() : ''
  if (!t) {
    throw new Error('Sign in to use AI generation.')
  }
  return { Authorization: `Bearer ${t}` }
}
