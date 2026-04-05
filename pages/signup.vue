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
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
        <p class="text-gray-600">Email and password only — no verification email</p>
      </div>

      <div class="border border-gray-200 rounded-xl p-8 bg-white border border-gray-200 shadow-lg">
        <form @submit.prevent="handleSignup" class="space-y-6">
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
              Confirm Password
            </label>
            <input
              id="passwordConfirm"
              v-model="formData.passwordConfirm"
              type="password"
              autocomplete="new-password"
              required
              class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="••••••••"
            />
          </div>

          <p v-if="!loading && validationHint" class="text-xs text-gray-500 text-center">
            {{ validationHint }}
          </p>

          <button
            type="submit"
            :disabled="loading"
            class="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="!loading">Create Account</span>
            <span v-else class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating account...
            </span>
          </button>
        </form>

        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600">
            Already have an account?
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
import logo from '~/assets/img/logo.svg'

definePageMeta({
  layout: false
})

const { signup } = useAuth()
const router = useRouter()

const formData = ref({
  email: '',
  password: '',
  passwordConfirm: ''
})

const loading = ref(false)
const error = ref('')

/** Shown under the button so users know why submit might fail (no disabled “mystery” button). */
const validationHint = computed(() => {
  const email = formData.value.email?.trim() ?? ''
  const { password, passwordConfirm } = formData.value
  if (!email) return 'Enter email, password (8+ characters), and matching confirmation to sign up.'
  if (!password || !passwordConfirm) return 'Enter and confirm your password (8+ characters).'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (password !== passwordConfirm) return 'Passwords must match.'
  return ''
})

const handleSignup = async () => {
  error.value = ''

  const email = formData.value.email?.trim() ?? ''
  if (!email) {
    error.value = 'Please enter your email address.'
    return
  }
  if (!formData.value.password || !formData.value.passwordConfirm) {
    error.value = 'Please enter and confirm your password.'
    return
  }
  if (formData.value.password !== formData.value.passwordConfirm) {
    error.value = 'Passwords do not match.'
    return
  }
  if (formData.value.password.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }

  loading.value = true

  try {
    const result = await signup(email, formData.value.password, formData.value.passwordConfirm)
    
    if (result.success) {
      // Redirect to home page
      await router.push('/')
    } else {
      error.value = result.error || 'Signup failed. Please try again.'
    }
  } catch (err) {
    error.value = 'An unexpected error occurred. Please try again.'
    console.error('Signup error:', err)
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

