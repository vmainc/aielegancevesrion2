import PocketBase from 'pocketbase'
import { createError } from 'h3'
import { resolvePocketBaseAdmin } from '~/server/utils/server-env'

const isDev = process.env.NODE_ENV !== 'production'

function pbDebug (...args: unknown[]) {
  if (isDev) console.log(...args)
}

function pbWarn (...args: unknown[]) {
  if (isDev) console.warn(...args)
}

// Cache the authenticated PocketBase instance to avoid rate limiting
let cachedPocketBase: PocketBase | null = null
let authPromise: Promise<PocketBase> | null = null
let lastAuthTime = 0
const AUTH_CACHE_DURATION = 55 * 60 * 1000 // 55 minutes (tokens typically last 60 minutes)

/**
 * Get an authenticated PocketBase instance for server-side use
 * Authenticates as admin if credentials are provided in environment variables
 * Uses caching to avoid rate limiting on repeated requests
 */
export async function getAuthenticatedPocketBase() {
  const config = useRuntimeConfig()
  const admin = resolvePocketBaseAdmin(config)
  const internal =
    admin.internalUrl ||
    String(config.pocketbaseInternalUrl || '')
      .trim()
      .replace(/\/+$/, '')
  const pbUrl = internal || config.public.pocketbaseUrl
  const now = Date.now()
  
  // Check if we have a cached instance that's still valid
  if (cachedPocketBase && (now - lastAuthTime) < AUTH_CACHE_DURATION) {
    // Check if token is still valid
    if (cachedPocketBase.authStore.isValid && cachedPocketBase.authStore.model) {
      return cachedPocketBase
    }
  }
  
  // If there's already an auth in progress, wait for it
  if (authPromise) {
    return authPromise
  }
  
  // Create new authentication promise
  authPromise = (async () => {
    try {
      const pb = new PocketBase(pbUrl)
      // This instance is shared across concurrent Nitro requests; disable SDK auto-cancel
      // so one request cannot abort another with the same endpoint/filter.
      pb.autoCancellation(false)
      
      // Authenticate as admin if credentials are provided (runtimeConfig and/or process.env)
      if (admin.email && admin.password) {
        try {
          pbDebug('PocketBase admin authentication starting')
          
          // Validate credentials format
          if (!admin.email.includes('@')) {
            console.error('PocketBase admin email does not contain @ symbol')
          }
          
          // PocketBase 0.23+ uses _superusers; legacy pb.admins.* targets removed API
          await pb.collection('_superusers').authWithPassword(
            admin.email,
            admin.password
          )
          
          pbDebug('PocketBase admin authenticated successfully')
          
          // Cache the authenticated instance
          cachedPocketBase = pb
          lastAuthTime = Date.now()
          authPromise = null
          return pb
        } catch (error: any) {
          console.error('Failed to authenticate PocketBase admin:', error.message || error)
          
          // Extract more detailed error information
          let detailedMessage = error.message || 'Unknown error'
          if (error.data) {
            if (typeof error.data === 'string') {
              detailedMessage = error.data
            } else if (error.data.message) {
              detailedMessage = error.data.message
            } else if (error.data.email || error.data.password) {
              detailedMessage = `Authentication failed: ${error.data.email || error.data.password || 'Invalid credentials'}`
            }
          } else if (error.response?.data) {
            if (typeof error.response.data === 'string') {
              detailedMessage = error.response.data
            } else if (error.response.data.message) {
              detailedMessage = error.response.data.message
            }
          }
          
          // Handle rate limiting specially
          if (error.status === 429) {
            pbWarn('PocketBase rate limit (429) — waiting before retry')
            
            // Wait a bit before clearing promise (allow retry)
            await new Promise(resolve => setTimeout(resolve, 1000))
            authPromise = null
            
            throw createError({
              statusCode: 429,
              message: 'Rate limit exceeded. Please wait a moment and try again.'
            })
          }
          
          if (pbUrl.includes('pockethost.io') || pbUrl.includes('pockethost')) {
            pbWarn('PocketHost URL detected — verify POCKETBASE_ADMIN_* env vars')
          }
          
          // Clear cache on error
          cachedPocketBase = null
          authPromise = null
          
          // Don't continue - throw the error so callers know auth failed
          throw createError({
            statusCode: error.status === 429 ? 429 : 500,
            message: `PocketBase admin authentication failed: ${detailedMessage}. Verify POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD for the server process.`
          })
        }
      } else {
        pbWarn(
          'PocketBase admin credentials not configured — set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD'
        )
        
        authPromise = null
        throw createError({
          statusCode: 500,
          message: 'PocketBase admin credentials not configured. Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD environment variables.'
        })
      }
    } catch (error: any) {
      // Clear auth promise on any error (that isn't already handled)
      if (!error.statusCode || error.statusCode !== 429) {
        authPromise = null
      }
      throw error
    }
  })()
  
  return authPromise
}
