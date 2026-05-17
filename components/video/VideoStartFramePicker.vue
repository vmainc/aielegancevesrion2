<template>
  <div
    class="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-3"
    :class="compact ? '' : 'p-4'"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs font-medium text-gray-700">
        Starting frame
        <span class="font-normal text-gray-500">(optional)</span>
      </p>
      <button
        v-if="frameImageUrl"
        type="button"
        class="text-[11px] font-medium text-gray-600 hover:text-red-700"
        @click="clearFrame"
      >
        Remove
      </button>
    </div>
    <p v-if="!compact" class="text-xs text-gray-500">
      Upload a still or generate one from your prompt. Video models use this as the first frame (image-to-video).
    </p>
    <p v-else class="text-[11px] text-gray-500 leading-snug">
      Upload or generate a still to animate when no storyboard frame is set.
    </p>

    <div class="flex flex-col sm:flex-row gap-3 items-start">
      <div
        v-if="previewUrl"
        class="rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0"
        :class="compact ? 'w-20 h-20' : 'w-28 h-28'"
      >
        <img
          :src="previewUrl"
          alt="Starting frame preview"
          class="w-full h-full object-cover"
        >
      </div>
      <div class="flex-1 min-w-0 space-y-2">
        <input
          ref="fileInputEl"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="block w-full text-xs text-gray-700 file:mr-2 file:py-1.5 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-gray-950 hover:file:bg-primary/90"
          @change="onFileChange"
        >
        <div v-if="!compact" class="flex flex-col sm:flex-row sm:items-end gap-2">
          <div class="flex-1 min-w-0">
            <label class="block text-[11px] font-medium text-gray-600 mb-1">Image model (for generate)</label>
            <select
              v-model="imageModelId"
              class="w-full px-2 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs"
            >
              <option
                v-for="m in imageModels"
                :key="m.id"
                :value="m.id"
              >
                {{ m.label }}
              </option>
            </select>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
            :disabled="generatingFrame || !prompt.trim()"
            @click="generateFrame"
          >
            {{ generatingFrame ? 'Generating…' : 'Generate starting frame' }}
          </button>
        </div>
        <button
          v-else
          type="button"
          class="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          :disabled="generatingFrame || !prompt.trim()"
          @click="generateFrame"
        >
          {{ generatingFrame ? 'Generating…' : 'Generate frame' }}
        </button>
        <p v-if="frameLabel" class="text-[11px] text-gray-600">
          {{ frameLabel }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CHARACTER_CREATOR_IMAGE_MODELS } from '~/lib/character-creator-models'
import {
  blobToDataUrl,
  firstImageUrlFromGenerateResponse,
  maybeCompressImageBlob
} from '~/lib/image-blob-client'

const props = withDefaults(
  defineProps<{
    /** Text prompt used when generating a starting frame. */
    prompt: string
    compact?: boolean
    /** v-model: URL for video API (`data:` or `http`). */
    frameImageUrl?: string | null
  }>(),
  { compact: false, frameImageUrl: null }
)

const emit = defineEmits<{
  'update:frameImageUrl': [value: string | null]
}>()

const toast = useToast()
const imageModels = CHARACTER_CREATOR_IMAGE_MODELS
const imageModelId = ref('flux-klein')
const generatingFrame = ref(false)
const frameLabel = ref('')
const fileInputEl = ref<HTMLInputElement | null>(null)

const previewUrl = computed(() => props.frameImageUrl || null)

function syncEmit (url: string | null, label: string) {
  frameLabel.value = label
  emit('update:frameImageUrl', url)
}

function clearFrame () {
  syncEmit(null, '')
  if (fileInputEl.value) fileInputEl.value.value = ''
}

async function onFileChange (event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.showToast('Choose an image file (JPEG, PNG, WebP, or GIF).', 'warning')
    return
  }
  try {
    const blob = file.size > 3_500_000 ? await maybeCompressImageBlob(file) : file
    const dataUrl = await blobToDataUrl(blob)
    syncEmit(dataUrl, `Uploaded: ${file.name}`)
    toast.showToast('Starting frame attached.', 'success')
  } catch {
    toast.showToast('Could not read that image.', 'error')
    if (fileInputEl.value) fileInputEl.value.value = ''
  }
}

async function generateFrame () {
  const p = props.prompt.trim()
  if (!p) {
    toast.showToast('Add a prompt first.', 'info')
    return
  }
  generatingFrame.value = true
  try {
    const res = await $fetch<{ urls?: unknown[] }>('/api/generate/image', {
      method: 'POST',
      body: { prompt: p, model: imageModelId.value }
    })
    const url = firstImageUrlFromGenerateResponse(res.urls || [])
    if (!url) {
      toast.showToast('No image returned — try another model.', 'warning')
      return
    }
    syncEmit(url, `Generated (${imageModelId.value})`)
    toast.showToast('Starting frame ready — generate video when ready.', 'success')
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Image generation failed')
        : 'Image generation failed'
    toast.showToast(msg, 'error')
  } finally {
    generatingFrame.value = false
  }
}
</script>
