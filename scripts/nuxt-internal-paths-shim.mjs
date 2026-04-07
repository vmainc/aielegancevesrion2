/**
 * Node subpath import shim for Nuxt's virtual module `#internal/nuxt/paths`.
 * The SSR chunk under `.nuxt/dist/server/server.mjs` can be loaded by plain Node
 * (e.g. stale build after `nuxt build`, or tooling) where Vite has not inlined aliases.
 * @see https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/core/nitro/utils/paths.ts
 */
import { joinRelativeURL } from 'ufo'

const appBase = () =>
  (typeof process !== 'undefined' && process.env && process.env.NUXT_APP_BASE_URL) || '/'

export function baseURL () {
  return appBase()
}

export function buildAssetsDir () {
  return '/_nuxt/'
}

export function buildAssetsURL (...path) {
  return joinRelativeURL(publicAssetsURL(), buildAssetsDir(), ...path)
}

export function publicAssetsURL (...path) {
  const publicBase = appBase()
  return path.length ? joinRelativeURL(publicBase, ...path) : publicBase
}
