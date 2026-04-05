export default defineNuxtRouteMiddleware(async (to, from) => {
  // Only check auth on client side
  if (process.server) {
    return
  }

  const { isAuthenticated, initAuth } = useAuth()
  
  // Wait for auth initialization to complete
  await initAuth()
  
  // Double-check after initialization
  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})

