import PocketBase from 'pocketbase'

let browserInstance: PocketBase | null = null

/**
 * Shared browser PocketBase client. Auth tokens live on this instance's authStore
 * so login, history, and account pages all see the same session.
 * Server routes must use `getAuthenticatedPocketBase()` instead — never this helper.
 */
export function getSharedPocketBaseClient (baseUrl: string): PocketBase {
  const url = String(baseUrl || '').replace(/\/+$/, '')
  if (!browserInstance) {
    browserInstance = new PocketBase(url)
    browserInstance.autoCancellation(false)
    return browserInstance
  }
  if (browserInstance.baseUrl.replace(/\/+$/, '') !== url) {
    browserInstance.baseUrl = url
  }
  return browserInstance
}

/** Test-only: drop the singleton (Vitest / HMR). */
export function resetSharedPocketBaseClient (): void {
  browserInstance = null
}
