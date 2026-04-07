import { resolvePocketBaseUrlFromEnv } from './lib/resolve-pocketbase-url'
import { NODE_HTTP_LONG_MS } from './lib/script-wizard-timeouts'

/** Nitro proxies browser /pb → PocketBase so :3000 and /pb share one origin (fixes CORS on login). */
const pocketbaseProxyTarget = (
  process.env.NUXT_POCKETBASE_INTERNAL_URL ||
  process.env.POCKETBASE_INTERNAL_URL ||
  'http://127.0.0.1:8090'
).replace(/\/+$/, '')

export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  tailwindcss: {
    // PostCSS/Tailwind config only — global CSS is imported from app.vue so the client bundle
    // includes utilities (see nuxt + Vite 6: nuxt.options.css alone can omit them from emitted CSS).
    cssPath: false,
  },
  // Default bind is often IPv6-only (::1); browsers using http://127.0.0.1:3000 then miss the
  // dev server and static assets/CSS appear "broken". Listen on all interfaces in dev.
  devServer: {
    host: process.env.NUXT_DEV_HOST || '0.0.0.0',
    ...(process.env.NUXT_DEV_PORT
      ? { port: Number(process.env.NUXT_DEV_PORT) }
      : {})
  },
  hooks: {
    // Dev + production Node: default request timeout (~5 min) can kill large PDF uploads + LLM before save.
    listen (server: import('http').Server) {
      server.requestTimeout = NODE_HTTP_LONG_MS
      server.headersTimeout = NODE_HTTP_LONG_MS
      server.setTimeout(NODE_HTTP_LONG_MS)
    }
  },
  // Only when running `npm run dev` — never during `npm run build` / deploy (avoids dev client in .output).
  devtools: { enabled: process.env.npm_lifecycle_event === 'dev' },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    }
  },
  runtimeConfig: {
    // Server-side only (private)
    openrouterApiKey:
      process.env.NUXT_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    omdbApiKey: process.env.OMDB_API_KEY || '7d5b2e8e',
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
      '/questions/**': { redirect: { to: '/', statusCode: 301 } },
      '/dashboard': { redirect: { to: '/projects', statusCode: 301 } },
      '/dashboard/**': { redirect: { to: '/projects', statusCode: 301 } }
    }
  }
})

