import PocketBase from 'pocketbase'
import { createError } from 'h3'
import { resolvePocketBaseAdmin } from '~/server/utils/server-env'

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
      
      // Authenticate as admin if credentials are provided (runtimeConfig and/or process.env)
      if (admin.email && admin.password) {
        try {
          console.log('🔐 Attempting admin authentication...')
          console.log('   Email:', admin.email ? `${admin.email.substring(0, 3)}***` : 'not set')
          console.log('   Email length:', admin.email?.length || 0)
          console.log('   Password configured:', !!admin.password)
          console.log('   Password length:', admin.password?.length || 0)
          console.log('   PocketBase URL:', pbUrl)
          
          // Validate credentials format
          if (!admin.email.includes('@')) {
            console.error('⚠️  Warning: Admin email does not contain @ symbol')
          }
          
          // PocketBase 0.23+ uses _superusers; legacy pb.admins.* targets removed API
          await pb.collection('_superusers').authWithPassword(
            admin.email,
            admin.password
          )
          
          const authData = pb.authStore.model
          console.log('✅ PocketBase admin authenticated successfully')
          console.log('   Admin ID:', authData?.id || 'unknown')
          console.log('   Token valid:', pb.authStore.isValid)
          
          // Cache the authenticated instance
          cachedPocketBase = pb
          lastAuthTime = Date.now()
          authPromise = null
          return pb
        } catch (error: any) {
          console.error('❌ Failed to authenticate PocketBase admin')
          console.error('   Error message:', error.message)
          console.error('   Error status:', error.status)
          console.error('   Error statusCode:', error.statusCode)
          console.error('   Error response:', error.response)
          console.error('   Error data:', error.data)
          console.error('   PocketBase URL:', pbUrl)
          console.error('   Admin email configured:', !!admin.email)
          console.error('   Admin email (first 3 chars):', admin.email ? admin.email.substring(0, 3) + '***' : 'not set')
          console.error('   Admin password configured:', !!admin.password)
          
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
            console.error('⚠️  Rate limit detected (429) - Too many authentication requests')
            console.error('   This should be resolved with authentication caching')
            console.error('   Waiting a moment before retrying...')
            
            // Wait a bit before clearing promise (allow retry)
            await new Promise(resolve => setTimeout(resolve, 1000))
            authPromise = null
            
            throw createError({
              statusCode: 429,
              message: 'Rate limit exceeded. Please wait a moment and try again.'
            })
          }
          
          if (pbUrl.includes('pockethost.io') || pbUrl.includes('pockethost')) {
            console.error('⚠️  PocketHost-style URL detected')
            console.error('   If credentials work in the admin UI, check env values for stray whitespace')
            console.error('   and that POCKETBASE_ADMIN_* are available to the Node server process.')
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
        const hasEmail = !!admin.email
        const hasPassword = !!admin.password
        console.warn('⚠️  PocketBase admin credentials not configured.')
        console.warn(`   Email configured: ${hasEmail}, Password configured: ${hasPassword}`)
        console.warn('   Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD environment variables.')
        console.warn('   Server-side operations may fail without admin authentication.')
        
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
