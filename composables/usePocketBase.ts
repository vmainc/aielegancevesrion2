import { resolveBrowserPocketBaseUrl } from '~/lib/resolve-browser-pocketbase-url'
import { getSharedPocketBaseClient } from '~/lib/create-pocketbase-client'

/**
 * Browser/client PocketBase helper — always the shared authenticated instance.
 * Do not construct `new PocketBase()` in pages or components.
 */
export const usePocketBase = () => {
  const config = useRuntimeConfig()
  const base = import.meta.client
    ? resolveBrowserPocketBaseUrl(String(config.public.pocketbaseUrl || ''))
    : String(config.public.pocketbaseUrl || '')
  return getSharedPocketBaseClient(base)
}
