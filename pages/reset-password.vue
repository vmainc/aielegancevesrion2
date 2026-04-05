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
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Set New Password</h1>
        <p class="text-gray-600">Enter your new password below</p>
      </div>

      <div class="border border-gray-200 rounded-xl p-8 bg-white border border-gray-200 shadow-lg">
        <form @submit.prevent="handleResetPassword" class="space-y-6">
          <div v-if="error" class="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p class="text-red-400 text-sm">{{ error }}</p>
          </div>

          <div v-if="success" class="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
            <p class="text-green-400 text-sm">{{ success }}</p>
          </div>

          <div>
            <label for="password" class="block text-sm font-semibold text-gray-700 mb-2">
              New Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              required
              minlength="8"
              class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="••••••••"
            />
            <p class="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
          </div>

          <div>
            <label for="passwordConfirm" class="block text-sm font-semibold text-gray-700 mb-2">
              Confirm New Password
            </label>
            <input
              id="passwordConfirm"
              v-model="passwordConfirm"
              type="password"
              autocomplete="new-password"
              required
              minlength="8"
              class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            :disabled="loading || !isFormValid"
            class="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="!loading">Reset Password</span>
            <span v-else class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Resetting...
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

<script setup lang="ts">
import logo from '~/assets/img/logo.svg'

definePageMeta({
  layout: false
})

const { confirmPasswordReset } = useAuth()
const route = useRoute()
const router = useRouter()

const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

const token = computed(() => {
  const tokenValue = route.query.token
  return typeof tokenValue === 'string' ? tokenValue : ''
})

const isFormValid = computed(() => {
  return (
    password.value &&
    passwordConfirm.value &&
    password.value === passwordConfirm.value &&
    password.value.length >= 8
  )
})

const handleResetPassword = async () => {
  error.value = ''
  success.value = ''

  if (!token.value) {
    error.value = 'Invalid reset token. Please use the link from your email.'
    return
  }

  if (password.value !== passwordConfirm.value) {
    error.value = 'Passwords do not match'
    return
  }

  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }

  loading.value = true

  try {
    const result = await confirmPasswordReset(token.value, password.value, passwordConfirm.value)
    
    if (result.success) {
      success.value = 'Password reset successfully! Redirecting to login...'
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } else {
      error.value = result.error || 'Failed to reset password. The token may be invalid or expired.'
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

  if (!token.value) {
    error.value = 'No reset token provided. Please use the link from your email.'
  }
})
</script>

