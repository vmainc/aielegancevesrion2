<template>
  <div class="mb-5 rounded-lg border border-gray-200 bg-white px-3 py-3">
    <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
      <div>
        <label class="block text-sm font-medium text-gray-700">
          Reference image
          <span class="font-normal text-gray-500">(optional)</span>
        </label>
        <p class="text-xs text-gray-500 mt-0.5">
          Mood board, character art, or location — models use it for story, prompts, and director bible.
        </p>
      </div>
      <button
        v-if="previewUrl"
        type="button"
        class="text-xs font-medium text-gray-600 hover:text-red-700"
        :disabled="disabled || uploading"
        @click="clear"
      >
        Remove
      </button>
    </div>

    <div v-if="previewUrl" class="flex gap-3 items-start">
      <button
        type="button"
        class="shrink-0 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 hover:ring-2 hover:ring-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :disabled="disabled || uploading"
        @click="openPreview"
      >
        <img
          :src="previewUrl"
          alt="Reference preview"
          class="w-24 h-24 sm:w-28 sm:h-28 object-cover"
        >
      </button>
      <p class="text-xs text-gray-500 pt-1">
        Click thumbnail to preview. Selected AI models will analyze this with your text.
      </p>
    </div>

    <input
      ref="fileInputEl"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="block w-full text-xs text-gray-700 file:mr-2 file:py-1.5 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-gray-950 hover:file:bg-primary/90 disabled:opacity-50"
      :disabled="disabled || uploading"
      @change="onFileChange"
    >
    <p v-if="uploading" class="mt-2 text-xs text-gray-500">Uploading reference image…</p>
    <p v-if="error" class="mt-2 text-xs text-red-600">{{ error }}</p>
  </div>

  <Teleport to="body">
    <div
      v-if="expanded"
      class="fixed inset-0 z-[110] bg-black/92 flex flex-col p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Reference image preview"
      @click.self="expanded = false"
      @keydown.escape="expanded = false"
    >
      <div class="max-w-5xl w-full mx-auto flex flex-col flex-1 min-h-0">
        <div class="flex justify-end mb-3 shrink-0">
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white"
            @click="expanded = false"
          >
            Close
          </button>
        </div>
        <img
          :src="previewUrl || ''"
          alt="Reference image"
          class="w-full flex-1 min-h-[40vh] max-h-[calc(100vh-5rem)] rounded-lg object-contain mx-auto"
        >
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { formatApiFetchError } from '~/lib/format-api-fetch-error'

const props = defineProps<{
  disabled?: boolean
}>()

const model = defineModel<string | null>({ default: null })

const { getAuthToken } = useAuth()

const fileInputEl = ref<HTMLInputElement | null>(null)
const previewUrl = ref('')
const error = ref('')
const expanded = ref(false)
const uploading = ref(false)

watch(
  () => model.value,
  (v) => {
    previewUrl.value = v || ''
  },
  { immediate: true }
)

function openPreview () {
  if (previewUrl.value) expanded.value = true
}

function clear () {
  model.value = null
  previewUrl.value = ''
  error.value = ''
  if (fileInputEl.value) fileInputEl.value.value = ''
}

async function onFileChange (ev: Event) {
  error.value = ''
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    error.value = 'Please choose a JPEG, PNG, WebP, or GIF image.'
    return
  }
  const token = getAuthToken()
  if (!token) {
    error.value = 'Log in to attach a reference image.'
    return
  }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await $fetch<{ url?: string }>('/api/concept-reference/stage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    })
    const url = (res.url || '').trim()
    if (!url) {
      throw new Error('Upload did not return a URL')
    }
    model.value = url
    previewUrl.value = url
  } catch (e: unknown) {
    error.value = formatApiFetchError(e, 'Could not upload reference image.')
    clear()
  } finally {
    uploading.value = false
  }
}
</script>
