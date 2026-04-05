<template>
  <div class="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <NuxtLink to="/" class="inline-block mb-4">
          <img
            :src="logo"
            alt="AI Elegance"
            class="h-16 w-auto mx-auto"
          />
        </NuxtLink>
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
        <p class="text-gray-600">Sign in to your account to continue</p>
      </div>

      <div class="border border-gray-200 rounded-xl p-8 bg-white border border-gray-200 shadow-lg">
        <form @submit.prevent="handleLogin" class="space-y-6">
          <div v-if="error" class="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p class="text-red-400 text-sm">{{ error }}</p>
          </div>

          <div>
            <label for="email" class="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              v-model="formData.email"
              type="email"
              autocomplete="email"
              required
              class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              v-model="formData.password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="!loading">Sign In</span>
            <span v-else class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            </span>
          </button>
        </form>

        <div class="mt-6 space-y-3 text-center">
          <p class="text-sm text-gray-600">
            Don't have an account?
            <NuxtLink to="/signup" class="text-primary hover:text-primary/80 font-semibold transition-colors">
              Sign up
            </NuxtLink>
          </p>
          <p class="text-sm text-gray-600">
            <NuxtLink to="/forgot-password" class="text-primary hover:text-primary/80 font-semibold transition-colors">
              Forgot your password?
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import logo from '~/assets/img/logo.svg'

definePageMeta({
  layout: false
})

const { login } = useAuth()
const router = useRouter()

const formData = ref({
  email: '',
  password: ''
})

const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  error.value = ''
  loading.value = true

  try {
    const result = await login(formData.value.email, formData.value.password)
    
    if (result.success) {
      // Redirect to home page or return URL
      const returnTo = router.options.history.state.back || '/'
      await router.push(returnTo)
    } else {
      error.value = result.error || 'Login failed. Please check your credentials.'
    }
  } catch (err) {
    error.value = 'An unexpected error occurred. Please try again.'
    console.error('Login error:', err)
  } finally {
    loading.value = false
  }
}

// Redirect if already logged in
onMounted(async () => {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated.value) {
    await router.push('/')
  }
})
</script>

