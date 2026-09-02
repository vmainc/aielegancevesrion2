export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  tailwindcss: {
    cssPath: '~/assets/css/main.css'
  },
  devServer: {
    host: process.env.NUXT_DEV_HOST || '127.0.0.1',
    port: Number(process.env.NUXT_DEV_PORT || process.env.PORT || 3001)
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'AIElegance — Ask once. Compare the answers.',
      meta: [
        {
          name: 'description',
          content: 'Ask one question and see how leading AI models respond, side by side.'
        },
        { name: 'theme-color', content: '#F6F3EE' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600&display=swap'
        }
      ]
    }
  },
  runtimeConfig: {
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    openrouterTitle: process.env.OPENROUTER_TITLE || 'AIElegance',
    openrouterReferer: process.env.OPENROUTER_REFERER || 'https://aielegance.com',
    modelsJson: process.env.AIELEGANCE_MODELS || '',
    maxPromptChars: process.env.AIELEGANCE_MAX_PROMPT_CHARS || '4000',
    maxOutputTokens: process.env.AIELEGANCE_MAX_OUTPUT_TOKENS || '1200',
    timeoutMs: process.env.AIELEGANCE_TIMEOUT_MS || '45000',
    rateLimit: process.env.AIELEGANCE_RATE_LIMIT || '8',
    rateWindowMs: process.env.AIELEGANCE_RATE_WINDOW_MS || '60000',
    public: {}
  },
  compatibilityDate: '2025-12-05',
  nitro: {
    preset: 'node-server'
  }
})
