'use strict'

/**
 * Same resolution order as utils/resolve-pocketbase-url.ts (Node scripts).
 * @param {string} [argvUrl] - optional CLI 4th argument override
 */
function resolvePocketBaseUrlFromEnv(argvUrl) {
  const cli = typeof argvUrl === 'string' && argvUrl.trim() !== '' ? argvUrl.trim() : ''
  const raw =
    cli ||
    process.env.POCKETBASE_URL ||
    process.env.NUXT_PUBLIC_POCKETBASE_URL ||
    process.env.VITE_POCKETBASE_URL ||
    'http://127.0.0.1:8090'
  return String(raw).replace(/\/+$/, '')
}

module.exports = { resolvePocketBaseUrlFromEnv }
