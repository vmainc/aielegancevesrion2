<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">Generate Image</h1>

    <form @submit.prevent="generate" class="mb-8">
      <div class="mb-4">
        <div class="flex justify-between items-center gap-2 mb-2">
          <label for="prompt" class="text-sm font-medium text-gray-700">Describe your image</label>
          <PromptEnhanceButton v-model="prompt" context="image" />
        </div>
        <textarea
          id="prompt"
          v-model="prompt"
          rows="3"
          placeholder="e.g. A serene mountain lake at sunset, digital art..."
          class="w-full px-4 py-3 bg-white border border-gray-200 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-primary transition-colors resize-y min-h-[80px]"
          required
        />
      </div>
      <p class="text-sm text-gray-600 mb-4">
        Generates one image per model so you can compare and pick the best.
      </p>
      <button
        type="submit"
        :disabled="loading"
        class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ loading ? `Generating... ${doneCount}/${imageModels.length}` : 'Generate with all models' }}
      </button>
    </form>

    <div v-if="globalError" class="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
      <p class="text-red-400 text-sm">{{ globalError }}</p>
    </div>

    <div v-if="hasAnyResult" class="space-y-6">
      <h2 class="text-xl font-semibold text-gray-800">Compare by model</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div
          v-for="opt in imageModels"
          :key="opt.id"
          class="rounded-xl overflow-hidden border border-gray-200 bg-white border border-gray-200 flex flex-col"
        >
          <div class="p-3 border-b border-gray-200">
            <span class="text-sm font-medium text-gray-800">{{ opt.label }}</span>
          </div>
          <div class="flex-1 min-h-[200px] flex items-center justify-center bg-gray-100">
            <template v-if="results[opt.id]?.status === 'loading'">
              <div class="flex flex-col items-center gap-2 py-8 text-gray-600">
                <svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span class="text-xs">Generating...</span>
              </div>
            </template>
            <template v-else-if="results[opt.id]?.status === 'done' && imageSrc(results[opt.id].url)">
              <img
                :src="imageSrc(results[opt.id].url)"
                :alt="opt.label"
                class="w-full h-auto object-cover"
              />
            </template>
            <template v-else-if="results[opt.id]?.status === 'error'">
              <p class="text-red-400/90 text-sm px-4 py-6 text-center">{{ results[opt.id].error || 'Failed' }}</p>
            </template>
            <template v-else>
              <p class="text-gray-500 text-sm py-8">—</p>
            </template>
          </div>
          <div v-if="results[opt.id]?.status === 'done' && imageSrc(results[opt.id].url)" class="p-3 border-t border-gray-200 flex items-center justify-between gap-2">
            <a
              :href="imageSrc(results[opt.id].url)"
              :target="isDataUrl(results[opt.id].url) ? undefined : '_blank'"
              :rel="isDataUrl(results[opt.id].url) ? undefined : 'noopener noreferrer'"
              class="text-sm text-primary hover:underline"
            >
              {{ isDataUrl(results[opt.id].url) ? 'View full size' : 'Open in new tab' }}
            </a>
            <button
              type="button"
              class="text-sm text-primary hover:underline"
              @click="downloadImage(imageSrc(results[opt.id].url), opt.label)"
            >
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const prompt = ref('')
const loading = ref(false)
const globalError = ref('')
const results = ref<Record<string, { status: 'loading' | 'done' | 'error'; url?: string; error?: string }>>({})

const imageModels = [
  { id: 'flux-klein', label: 'FLUX.2 Klein (fast)' },
  { id: 'flux-pro', label: 'FLUX.2 Pro' },
  { id: 'flux-max', label: 'FLUX.2 Max' },
  { id: 'flux-flex', label: 'FLUX.2 Flex' },
  { id: 'gemini-flash', label: 'Gemini 2.5 Flash Image' },
  { id: 'gemini-pro-image', label: 'Gemini 3 Pro Image' },
  { id: 'gpt-5-image-mini', label: 'GPT-5 Image Mini' },
  { id: 'gpt-5-image', label: 'GPT-5 Image' }
]

function imageSrc (url: unknown): string {
  if (typeof url !== 'string') return ''
  return url.startsWith('data:') || url.startsWith('http') ? url : ''
}

function isDataUrl (url: unknown): boolean {
  return typeof url === 'string' && url.startsWith('data:')
}

function downloadImage (url: string, label: string) {
  if (!url) return
  const safeName = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'image'
  const ext = url.startsWith('data:image/png') ? 'png' : url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg') ? 'jpg' : 'png'
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}.${ext}`
  a.click()
}

const doneCount = computed(() => {
  return imageModels.filter((opt) => results.value[opt.id]?.status === 'done' || results.value[opt.id]?.status === 'error').length
})

const hasAnyResult = computed(() => {
  return imageModels.some((opt) => results.value[opt.id] != null)
})

const generate = async () => {
  if (!prompt.value.trim()) return
  loading.value = true
  globalError.value = ''
  const promptText = prompt.value.trim()

  imageModels.forEach((opt) => {
    results.value[opt.id] = { status: 'loading' }
  })
  results.value = { ...results.value }

  const promises = imageModels.map(async (opt) => {
    try {
      const result = await $fetch<{ urls: string[] }>('/api/generate/image', {
        method: 'POST',
        body: { prompt: promptText, model: opt.id }
      })
      const urls = result?.urls ?? []
      const first = urls.map((u: unknown) => (typeof u === 'string' ? u : (u && typeof u === 'object' && 'url' in u ? (u as { url: string }).url : ''))).filter(Boolean)[0]
      results.value[opt.id] = first ? { status: 'done', url: first } : { status: 'error', error: 'No image returned' }
    } catch (e: any) {
      const msg = e?.data?.message ?? e?.data?.error?.message ?? e?.message ?? 'Failed'
      results.value[opt.id] = { status: 'error', error: String(msg).slice(0, 120) }
    }
    results.value = { ...results.value }
  })

  await Promise.allSettled(promises)
  loading.value = false
}
</script>
