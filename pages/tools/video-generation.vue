<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <header class="mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
        Video generation
      </h1>
      <p class="mt-2 text-gray-600 text-sm sm:text-base max-w-2xl">
        Choose video-capable models and describe your shot. Generation runs through OpenRouter when enabled.
      </p>
    </header>

    <div v-if="pending" class="text-sm text-gray-600 mb-6 animate-pulse">
      Loading models…
    </div>

    <div
      v-else-if="error"
      class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-8"
    >
      {{ error }}
    </div>

    <template v-else>
      <p
        v-if="data?.notice"
        class="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"
      >
        {{ data.notice }}
      </p>

      <form class="space-y-8 mb-10" @submit.prevent="onSubmit">
        <section class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Video
          </h2>
          <div>
            <div class="flex justify-between items-center gap-2 mb-1.5">
              <label for="vg-prompt" class="text-sm font-medium text-gray-700">Prompt</label>
              <PromptEnhanceButton v-model="prompt" context="video" />
            </div>
            <textarea
              id="vg-prompt"
              v-model="prompt"
              rows="4"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
              placeholder="Describe the scene, motion, camera, mood, and duration you want"
            />
          </div>
          <div>
            <label for="vg-aspect" class="block text-sm font-medium text-gray-700 mb-1.5">Aspect ratio</label>
            <select
              id="vg-aspect"
              v-model="aspectRatio"
              class="w-full sm:max-w-md px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
            >
              <option value="16:9">16:9 (landscape)</option>
              <option value="9:16">9:16 (vertical)</option>
              <option value="1:1">1:1 (square)</option>
            </select>
          </div>
          <p class="text-xs text-gray-500">
            Video on OpenRouter is API-only and may be in alpha.
            <a
              href="https://openrouter.ai/models?fmt=cards&output_modalities=video"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
            >Browse models on OpenRouter</a>.
          </p>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
            Models
          </h2>
          <p class="text-xs text-gray-500 mb-4">
            Select one or more; when generation is enabled, runs will use your selections.
            <span v-if="data?.source === 'api'" class="block sm:inline sm:ml-1 mt-1 sm:mt-0">
              Live list (<code class="rounded bg-gray-100 px-1 py-0.5 text-gray-800">output_modalities=video</code>).
            </span>
          </p>
          <div v-if="!models.length" class="text-sm text-gray-500 py-2">
            No models loaded.
          </div>
          <div v-else class="flex flex-wrap gap-3">
            <label
              v-for="m in models"
              :key="m.id"
              class="inline-flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 max-w-full sm:max-w-[calc(50%-0.375rem)]"
            >
              <input
                v-model="selectedModelIds"
                type="checkbox"
                :value="m.id"
                class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
              >
              <span class="min-w-0">
                <span class="block text-sm text-gray-800 font-medium leading-snug">{{ m.name }}</span>
                <span class="block text-xs font-mono text-gray-500 truncate mt-0.5" :title="m.id">{{ m.id }}</span>
                <span
                  v-if="m.description"
                  class="block text-xs text-gray-500 line-clamp-2 mt-1"
                >{{ m.description }}</span>
              </span>
            </label>
          </div>
        </section>

        <div v-if="formError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {{ formError }}
        </div>

        <div>
          <button
            type="submit"
            class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canSubmit"
          >
            Generate Video
          </button>
          <p v-if="!VIDEO_GEN_ENABLED" class="mt-2 text-xs text-gray-500">
            Generation from this page is not wired yet — selections and prompt are saved for when the pipeline is connected.
          </p>
        </div>
      </form>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Results</h2>
        <div
          class="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 px-6 py-12 text-center text-sm text-gray-500"
        >
          Generated clips will appear here in a grid, similar to Character Creator results.
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
const toast = useToast()

type VideoModel = {
  id: string
  name: string
  description?: string
  provider?: string
  outputModalities?: string[]
}

type ApiPayload = {
  source?: string
  models?: VideoModel[]
  notice?: string
  error?: string
}

const { data, pending, error: fetchError } = await useFetch<ApiPayload>('/api/openrouter/video-models')

const error = computed(() => {
  if (fetchError.value) return 'Could not load models. Try again later.'
  return null
})

const models = computed(() => data.value?.models ?? [])

const prompt = ref('')
const aspectRatio = ref('16:9')
const selectedModelIds = ref<string[]>([])
const formError = ref('')

const VIDEO_GEN_ENABLED = false

const canSubmit = computed(() => selectedModelIds.value.length > 0 && !pending.value)

function onSubmit () {
  formError.value = ''
  if (!selectedModelIds.value.length) {
    formError.value = 'Select at least one model.'
    return
  }
  if (!VIDEO_GEN_ENABLED) {
    toast.showToast('Video generation from this page is not available yet.', 'info')
    return
  }
}

useHead({
  title: 'Video generation — AI Elegance',
  meta: [{ name: 'description', content: 'Select video models and describe your shot on AI Elegance.' }],
})
</script>
