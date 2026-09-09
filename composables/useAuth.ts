import { resolveBrowserPocketBaseUrl } from '~/lib/resolve-browser-pocketbase-url'
import { getSharedPocketBaseClient } from '~/lib/create-pocketbase-client'
import {
  friendlyLoginError,
  friendlyPasswordResetError,
  friendlyRegisterError
} from '~/lib/auth-errors'

type AuthUser = {
  id: string
  email?: string
  name?: string
  avatar?: string
  created?: string
  [key: string]: unknown
}

function asAuthUser (model: unknown): AuthUser | null {
  if (!model || typeof model !== 'object' || !('id' in (model as object))) return null
  return model as AuthUser
}

/** Attach once after hydration so SSR HTML matches the first client paint (avoids hydration mismatch). */
let authStoreListenerAttached = false

const getPocketBaseInstance = () => {
  const config = useRuntimeConfig()
  const base = import.meta.client
    ? resolveBrowserPocketBaseUrl(String(config.public.pocketbaseUrl || ''))
    : String(config.public.pocketbaseUrl || '')
  return getSharedPocketBaseClient(base)
}

export const useAuth = () => {
  const pb = getPocketBaseInstance()

  const user = useState<AuthUser | null>('auth_user', () => null)
  const authToken = useState<string | null>('auth_token', () => null)
  /** False until after first client mount + initAuth — layout stays on guest SSR markup during hydration. */
  const authReady = useState('auth_ready', () => false)
  const isAuthenticated = computed(() => !!user.value || !!authToken.value)
  /** Use in templates: true only when session is known and user is signed in. */
  const showAuthenticatedUi = computed(() => authReady.value && isAuthenticated.value)
  const currentUser = computed(() => user.value)

  if (import.meta.client && !authStoreListenerAttached) {
    authStoreListenerAttached = true
    pb.authStore.onChange((_token, model) => {
      user.value = asAuthUser(model)
      authToken.value = _token || null
    })
  }

  const initAuth = async () => {
    if (process.server) {
      return
    }

    try {
      user.value = asAuthUser(pb.authStore.model)
      authToken.value = pb.authStore.token || null

      if (!pb.authStore.token) {
        return
      }

      if (pb.authStore.model && pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh()
          user.value = asAuthUser(pb.authStore.model)
        } catch {
          if (pb.authStore.isValid && pb.authStore.model) {
            user.value = asAuthUser(pb.authStore.model)
            authToken.value = pb.authStore.token || null
          } else {
            pb.authStore.clear()
            user.value = null
            authToken.value = null
          }
        }
      } else if (pb.authStore.model && !pb.authStore.isValid && pb.authStore.token) {
        try {
          await pb.collection('users').authRefresh()
          user.value = asAuthUser(pb.authStore.model)
        } catch {
          pb.authStore.clear()
          user.value = null
          authToken.value = null
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      if (pb.authStore.model && pb.authStore.isValid) {
        user.value = asAuthUser(pb.authStore.model)
        authToken.value = pb.authStore.token || null
      } else {
        pb.authStore.clear()
        user.value = null
        authToken.value = null
      }
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email.trim(), password)
      user.value = asAuthUser(authData.record)
      authToken.value = pb.authStore.token || null
      return { success: true, error: null }
    } catch (error: unknown) {
      return {
        success: false,
        error: friendlyLoginError(error)
      }
    }
  }

  const register = async (
    name: string,
    email: string,
    password: string,
    passwordConfirm: string
  ) => {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      return { success: false, error: 'Please enter your name.' }
    }
    if (!trimmedEmail) {
      return { success: false, error: 'Please enter a valid email address.' }
    }
    if (password !== passwordConfirm) {
      return { success: false, error: 'Passwords do not match.' }
    }
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' }
    }

    try {
      await pb.collection('users').create({
        name: trimmedName,
        email: trimmedEmail,
        password,
        passwordConfirm,
        emailVisibility: true
      })

      const authData = await pb.collection('users').authWithPassword(trimmedEmail, password)
      user.value = asAuthUser(authData.record)
      authToken.value = pb.authStore.token || null

      return { success: true, error: null }
    } catch (error: unknown) {
      return {
        success: false,
        error: friendlyRegisterError(error)
      }
    }
  }

  /** @deprecated Use register() — kept for older call sites. */
  const signup = async (email: string, password: string, passwordConfirm: string) => {
    return register('', email, password, passwordConfirm)
  }

  const logout = () => {
    pb.authStore.clear()
    user.value = null
    authToken.value = null
    navigateTo('/login')
  }

  const getUserId = () => {
    return user.value?.id || null
  }

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
        error: 'Passwords do not match.'
      }
    }

    if (newPassword.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters.'
      }
    }

    try {
      await pb.collection('users').update(user.value.id, {
        oldPassword,
        password: newPassword,
        passwordConfirm
      })
      return { success: true, error: null }
    } catch {
      return {
        success: false,
        error: 'Could not change password. Check your current password and try again.'
      }
    }
  }

  const requestPasswordReset = async (email: string) => {
    try {
      await pb.collection('users').requestPasswordReset(email.trim())
      return { success: true, error: null }
    } catch {
      // Don't reveal whether the email exists
      return { success: true, error: null }
    }
  }

  const confirmPasswordReset = async (token: string, password: string, passwordConfirm: string) => {
    if (password !== passwordConfirm) {
      return {
        success: false,
        error: 'Passwords do not match.'
      }
    }

    if (password.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters.'
      }
    }

    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      return { success: true, error: null }
    } catch (error: unknown) {
      return {
        success: false,
        error: friendlyPasswordResetError(error)
      }
    }
  }

  const getPocketBase = () => {
    return pb
  }

  const getAuthToken = () => {
    if (process.server) return null
    return authToken.value || pb.authStore.token || null
  }

  const avatarUrl = computed(() => {
    if (!user.value?.avatar) return null
    try {
      return pb.files.getURL(user.value, String(user.value.avatar))
    } catch {
      return null
    }
  })

  return {
    user: readonly(user),
    currentUser,
    authReady: readonly(authReady),
    isAuthenticated,
    showAuthenticatedUi,
    avatarUrl,
    login,
    register,
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
