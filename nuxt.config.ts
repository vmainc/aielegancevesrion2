import { resolvePocketBaseUrlFromEnv } from './lib/resolve-pocketbase-url'

/** Nitro proxies browser /pb → PocketBase so :3000 and /pb share one origin (fixes CORS on login). */
const pocketbaseProxyTarget = (
  process.env.NUXT_POCKETBASE_INTERNAL_URL ||
  process.env.POCKETBASE_INTERNAL_URL ||
  'http://127.0.0.1:8090'
).replace(/\/+$/, '')

export default defineNuxtConfig({
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    }
  },
  css: ['~/assets/css/main.css'],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  runtimeConfig: {
    // Server-side only (private)
    openrouterApiKey:
      process.env.NUXT_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    pocketbaseAdminEmail:
      process.env.NUXT_POCKETBASE_ADMIN_EMAIL || process.env.POCKETBASE_ADMIN_EMAIL,
    pocketbaseAdminPassword:
      process.env.NUXT_POCKETBASE_ADMIN_PASSWORD || process.env.POCKETBASE_ADMIN_PASSWORD,
    // Direct PB URL for server-side API routes (auth-refresh, collections). Must be reachable from Node.
    // Defaults to the same host as Nitro’s /pb proxy so local dev works when NUXT_PUBLIC_* points at a remote /pb URL.
    pocketbaseInternalUrl:
      process.env.NUXT_POCKETBASE_INTERNAL_URL ||
      process.env.POCKETBASE_INTERNAL_URL ||
      pocketbaseProxyTarget,
    // Public (client + server); prefer VITE_POCKETBASE_URL for VPS /pb proxy setups
    public: {
      pocketbaseUrl: resolvePocketBaseUrlFromEnv()
    }
  },
  compatibilityDate: '2025-12-05',
  // Avoid /_nuxt/builds/meta/<uuid>.json — mismatched deploy or browser cache causes 500 on Node.
  experimental: {
    appManifest: false
  },
  nitro: {
    preset: 'node-server',
    routeRules: {
      '/pb/**': { proxy: `${pocketbaseProxyTarget}/**` },
      '/ask': { redirect: { to: '/', statusCode: 301 } },
      '/explore': { redirect: { to: '/', statusCode: 301 } },
      '/vault': { redirect: { to: '/', statusCode: 301 } },
      '/leaderboard': { redirect: { to: '/', statusCode: 301 } },
      '/meet-the-models': { redirect: { to: '/', statusCode: 301 } },
      '/my-questions': { redirect: { to: '/projects', statusCode: 301 } },
      '/my-questions/**': { redirect: { to: '/projects', statusCode: 301 } },
      '/questions/**': { redirect: { to: '/', statusCode: 301 } }
    }
  }
})

