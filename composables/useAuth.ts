import PocketBase from 'pocketbase'
import { getCurrentInstance, onMounted } from 'vue'
import { resolveBrowserPocketBaseUrl } from '~/lib/resolve-browser-pocketbase-url'

// Create a shared PocketBase instance
let pbInstance: PocketBase | null = null

/** Attach once after hydration so SSR HTML matches the first client paint (avoids hydration mismatch). */
let authStoreListenerAttached = false

const getPocketBaseInstance = () => {
  if (!pbInstance) {
    const config = useRuntimeConfig()
    const base = import.meta.client
      ? resolveBrowserPocketBaseUrl(config.public.pocketbaseUrl)
      : config.public.pocketbaseUrl
    pbInstance = new PocketBase(base)
  }
  return pbInstance
}

export const useAuth = () => {
  const pb = getPocketBaseInstance()
  
  // Initialize with null, will be set by initAuth
  const user = useState('auth_user', () => null)
  const isAuthenticated = computed(() => !!user.value)

  if (import.meta.client && !authStoreListenerAttached) {
    authStoreListenerAttached = true
    const syncFromPb = () => {
      user.value = pb.authStore.model || null
      pb.authStore.onChange((_token, model) => {
        user.value = model
      })
    }
    // Plugins and route middleware call useAuth() with no active component — onMounted would warn.
    if (getCurrentInstance()) {
      onMounted(syncFromPb)
    } else {
      syncFromPb()
    }
  }

  // Initialize auth from stored token
  const initAuth = async () => {
    // Only run on client side
    if (process.server) {
      return
    }

    try {
      // PocketBase automatically loads auth from localStorage when instance is created
      // Set user value from authStore (which has loaded from localStorage)
      user.value = pb.authStore.model || null

      if (!pb.authStore.token) {
        return
      }
      
      // If we have auth data and it's valid, try to refresh to get latest user data
      if (pb.authStore.model && pb.authStore.isValid) {
        try {
          // Try to refresh to ensure we have the latest user data
          await pb.collection('users').authRefresh()
          user.value = pb.authStore.model
        } catch (refreshError) {
          // Refresh failed - token might be expired or invalid
          // Check if token is still marked as valid
          if (pb.authStore.isValid && pb.authStore.model) {
            // Token still valid, use existing model
            user.value = pb.authStore.model
          } else {
            // Token is invalid/expired, clear it
            pb.authStore.clear()
            user.value = null
          }
        }
      } else if (pb.authStore.model && !pb.authStore.isValid && pb.authStore.token) {
        // We have a model but token is invalid - might be expired
        // Try refreshing once to see if we can renew it
        try {
          await pb.collection('users').authRefresh()
          user.value = pb.authStore.model
        } catch {
          // Can't refresh, token is truly invalid
          pb.authStore.clear()
          user.value = null
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      // On error, preserve auth if it's still valid, otherwise clear
      if (pb.authStore.model && pb.authStore.isValid) {
        user.value = pb.authStore.model
      } else {
        pb.authStore.clear()
        user.value = null
      }
    }
  }

  function formatLoginError(error: any): string {
    const genericPb = 'Something went wrong while processing your request.'
    const msg = typeof error?.message === 'string' ? error.message : ''
    if (msg && msg !== genericPb) {
      return msg
    }
    const orig = error?.originalError
    const net =
      orig?.name === 'TypeError' ||
      /failed to fetch|networkerror|load failed/i.test(String(orig?.message || ''))
    if (net || (error?.status === 0 && !error?.response?.data)) {
      return 'Cannot reach PocketBase. If the app is on a port like :3000, use a build with Nitro’s /pb proxy, or add this origin in PocketBase Settings → API.'
    }
    const data = error?.response?.data ?? error?.data
    if (data && typeof data === 'object') {
      const parts: string[] = []
      for (const key of Object.keys(data)) {
        const v = data[key]
        if (v?.message) parts.push(`${key}: ${v.message}`)
      }
      if (parts.length) return parts.join(' ')
    }
    return error?.response?.message || msg || 'Login failed'
  }

  // Login
  const login = async (email: string, password: string) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password)
      user.value = authData.record
      return { success: true, error: null }
    } catch (error: any) {
      return {
        success: false,
        error: formatLoginError(error)
      }
    }
  }

  function formatPocketBaseError(error: any, fallback: string): string {
    const data = error?.response?.data ?? error?.data
    if (data && typeof data === 'object') {
      const parts: string[] = []
      for (const key of Object.keys(data)) {
        const v = data[key]
        if (v?.message) parts.push(`${key}: ${v.message}`)
        else if (typeof v === 'string') parts.push(`${key}: ${v}`)
      }
      if (parts.length) return parts.join(' ')
    }
    return error?.response?.message || error?.message || fallback
  }

  // Signup (email + password only; no verification flow — disable that in PocketBase users collection)
  const signup = async (email: string, password: string, passwordConfirm: string) => {
    try {
      await pb.collection('users').create({
        email: email.trim(),
        password,
        passwordConfirm
      })

      const authData = await pb.collection('users').authWithPassword(email.trim(), password)
      user.value = authData.record

      return { success: true, error: null }
    } catch (error: any) {
      return {
        success: false,
        error: formatPocketBaseError(error, 'Signup failed')
      }
    }
  }

  // Logout
  const logout = () => {
    pb.authStore.clear()
    user.value = null
    navigateTo('/login')
  }

  // Get current user ID
  const getUserId = () => {
    return user.value?.id || null
  }

  // Change password (when logged in)
  const changePassword = async (oldPassword: string, newPassword: string, passwordConfirm: string) => {
    if (!user.value) {
      return {
        success: false,
        error: 'You must be logged in to change your password'
      }
    }

    if (newPassword !== passwordConfirm) {
      return {
        success: false,
        error: 'New passwords do not match'
      }
    }

    if (newPassword.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters'
      }
    }

    try {
      await pb.collection('users').update(user.value.id, {
        oldPassword,
        password: newPassword,
        passwordConfirm
      })
      return { success: true, error: null }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.message || error.message || 'Failed to change password'
      }
    }
  }

  // Request password reset (forgot password)
  const requestPasswordReset = async (email: string) => {
    try {
      await pb.collection('users').requestPasswordReset(email)
      return { success: true, error: null }
    } catch (error: any) {
      // Don't reveal if email exists or not for security
      return { success: true, error: null }
    }
  }

  // Confirm password reset (with token from email)
  const confirmPasswordReset = async (token: string, password: string, passwordConfirm: string) => {
    if (password !== passwordConfirm) {
      return {
        success: false,
        error: 'Passwords do not match'
      }
    }

    if (password.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters'
      }
    }

    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      return { success: true, error: null }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.message || error.message || 'Failed to reset password. The token may be invalid or expired.'
      }
    }
  }

  // Get PocketBase instance (with auth)
  const getPocketBase = () => {
    return pb
  }

  /** Bearer token for Nuxt server routes that validate the session (client only). */
  const getAuthToken = () => {
    if (process.server) return null
    return pb.authStore.token || null
  }

  return {
    user: readonly(user),
    isAuthenticated,
    login,
    signup,
    logout,
    getUserId,
    getPocketBase,
    getAuthToken,
    initAuth,
    changePassword,
    requestPasswordReset,
    confirmPasswordReset
  }
}

