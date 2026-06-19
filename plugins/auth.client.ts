export default defineNuxtPlugin((nuxtApp) => {
  // Run after hydration so layout/nav SSR markup matches the first client paint.
  nuxtApp.hook('app:mounted', async () => {
    const { initAuth } = useAuth()
    const authReady = useState('auth_ready')
    try {
      await initAuth()
    } finally {
      authReady.value = true
    }
  })
})
