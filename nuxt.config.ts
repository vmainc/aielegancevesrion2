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
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
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
    // Optional: direct PB URL for server-side API routes (e.g. http://127.0.0.1:8090) when public URL is a browser-only proxy
    pocketbaseInternalUrl:
      process.env.NUXT_POCKETBASE_INTERNAL_URL ||
      process.env.POCKETBASE_INTERNAL_URL ||
      '',
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
      '/pb/**': { proxy: `${pocketbaseProxyTarget}/**` }
    }
  }
})

