import PocketBase from 'pocketbase'
import { resolveBrowserPocketBaseUrl } from '~/lib/resolve-browser-pocketbase-url'

export const usePocketBase = () => {
  const config = useRuntimeConfig()
  const base = import.meta.client
    ? resolveBrowserPocketBaseUrl(config.public.pocketbaseUrl)
    : config.public.pocketbaseUrl
  return new PocketBase(base)
}

