import { safeInternalPath } from '~/lib/safe-internal-path'

export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) {
    return
  }

  const { isAuthenticated, initAuth } = useAuth()
  await initAuth()

  if (!isAuthenticated.value) {
    const next = safeInternalPath(to.fullPath, '/account')
    return navigateTo({
      path: '/login',
      query: { redirect: next }
    })
  }
})
