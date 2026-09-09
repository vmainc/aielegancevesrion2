<template>
  <div class="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-studio-charcoal">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <NuxtLink to="/" class="inline-block mb-4">
          <img
            :src="logo"
            alt="AI Film Studio"
            class="h-16 w-auto mx-auto"
          />
        </NuxtLink>
        <h1 class="font-display text-4xl text-ivory mb-2 tracking-wide">Create Account</h1>
        <p class="text-smoke">Join AI Film Studio and keep your conversations with you.</p>
      </div>

      <div class="border border-primary/25 rounded-xl p-8 bg-studio-slate shadow-lg">
        <form @submit.prevent="handleRegister" class="space-y-5">
          <div v-if="error" class="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p class="text-red-400 text-sm">{{ error }}</p>
          </div>

          <div>
            <label for="name" class="block text-sm font-semibold text-ivory mb-2">
              Name
            </label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              autocomplete="name"
              required
              class="w-full px-4 py-3 bg-studio-charcoal border border-gray-300 rounded-lg text-ivory placeholder-smoke focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="Your name"
            />
          </div>

          <div>
            <label for="email" class="block text-sm font-semibold text-ivory mb-2">
              Email
            </label>
            <input
              id="email"
              v-model="formData.email"
              type="email"
              autocomplete="email"
              required
              class="w-full px-4 py-3 bg-studio-charcoal border border-gray-300 rounded-lg text-ivory placeholder-smoke focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-semibold text-ivory mb-2">
              Password
            </label>
            <input
              id="password"
              v-model="formData.password"
              type="password"
              autocomplete="new-password"
              required
              minlength="8"
              class="w-full px-4 py-3 bg-studio-charcoal border border-gray-300 rounded-lg text-ivory placeholder-smoke focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="••••••••"
            />
            <p class="mt-1 text-xs text-smoke">At least 8 characters</p>
          </div>

          <div>
            <label for="passwordConfirm" class="block text-sm font-semibold text-ivory mb-2">
              Confirm Password
            </label>
            <input
              id="passwordConfirm"
              v-model="formData.passwordConfirm"
              type="password"
              autocomplete="new-password"
              required
              minlength="8"
              class="w-full px-4 py-3 bg-studio-charcoal border border-gray-300 rounded-lg text-ivory placeholder-smoke focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="••••••••"
            />
          </div>

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
          <p class="text-sm text-smoke">
            Already have an account?
            <NuxtLink to="/login" class="text-primary hover:text-primary/80 font-semibold transition-colors">
              Log In
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import logo from '~/assets/img/logo.png'
import { DEFAULT_AUTHENTICATED_PATH } from '~/lib/default-authenticated-path'
import { safeInternalPath } from '~/lib/safe-internal-path'

definePageMeta({
  layout: false
})

useHead({ title: 'Create Account' })

const { register, isAuthenticated, initAuth } = useAuth()
const router = useRouter()
const route = useRoute()

const formData = ref({
  name: '',
  email: '',
  password: '',
  passwordConfirm: ''
})

const loading = ref(false)
const error = ref('')

const handleRegister = async () => {
  if (loading.value) return
  error.value = ''

  if (!formData.value.name.trim()) {
    error.value = 'Please enter your name.'
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
    const result = await register(
      formData.value.name,
      formData.value.email,
      formData.value.password,
      formData.value.passwordConfirm
    )
    if (result.success) {
      const dest = safeInternalPath(route.query.redirect, DEFAULT_AUTHENTICATED_PATH)
      await router.push(dest)
    } else {
      error.value = result.error || 'Could not create your account. Please try again.'
    }
  } catch (err) {
    error.value = 'An unexpected error occurred. Please try again.'
    console.error('Register error:', err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await initAuth()
  if (isAuthenticated.value) {
    await router.push(safeInternalPath(route.query.redirect, DEFAULT_AUTHENTICATED_PATH))
  }
})
</script>
