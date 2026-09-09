import { safeInternalPath } from '~/lib/safe-internal-path'

const NEEDS_AUTH = [
  /^\/projects(\/|$)/,
  /^\/assets(\/|$)/,
  /^\/tools(\/|$)/,
  /^\/character-creator(\/|$)/,
  /^\/adapt-to-film(\/|$)/,
  /^\/account(\/|$)/,
  /^\/history(\/|$)/
]

function requiresWorkspaceAuth (path: string): boolean {
  return NEEDS_AUTH.some((re) => re.test(path))
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) return
  if (!requiresWorkspaceAuth(to.path)) return

  const { initAuth, isAuthenticated } = useAuth()
  await initAuth()

  if (isAuthenticated.value) return

  const next = safeInternalPath(to.fullPath, '/guide')
  return navigateTo({
    path: '/login',
    query: { redirect: next }
  })
})
