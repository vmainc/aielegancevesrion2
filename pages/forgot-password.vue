<template>
  <div class="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <NuxtLink to="/" class="inline-block mb-4">
          <img
            :src="logo"
            alt="AI Elegance"
            class="h-16 w-auto mx-auto rounded-md shadow-sm"
          />
        </NuxtLink>
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
        <p class="text-gray-600">Enter your email to receive a password reset link</p>
      </div>

      <div class="border border-gray-200 rounded-xl p-8 bg-white border border-gray-200 shadow-lg">
        <form @submit.prevent="handleRequestReset" class="space-y-6">
          <div v-if="error" class="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p class="text-red-400 text-sm">{{ error }}</p>
          </div>

          <div v-if="success" class="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
            <p class="text-green-400 text-sm">{{ success }}</p>
          </div>

          <div>
            <label for="email" class="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="!loading">Send Reset Link</span>
            <span v-else class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </span>
          </button>
        </form>

        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600">
            Remember your password?
            <NuxtLink to="/login" class="text-primary hover:text-primary/80 font-semibold transition-colors">
              Sign in
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import logo from '~/assets/img/logo.png'

definePageMeta({
  layout: false
})

const { requestPasswordReset } = useAuth()
const router = useRouter()

const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

const handleRequestReset = async () => {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    const result = await requestPasswordReset(email.value)
    
    if (result.success) {
      success.value = 'If an account with that email exists, a password reset link has been sent. Please check your email.'
      email.value = ''
    } else {
      error.value = result.error || 'Failed to send reset link. Please try again.'
    }
  } catch (err) {
    error.value = 'An unexpected error occurred. Please try again.'
    console.error('Password reset error:', err)
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

