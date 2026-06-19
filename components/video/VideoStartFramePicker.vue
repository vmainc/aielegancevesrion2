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
      Generated and uploaded frames are compressed to fit video limits (~900KB).
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
import {
  CHARACTER_CREATOR_IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL_ID
} from '~/lib/character-creator-models'
import { firstImageUrlFromGenerateResponse } from '~/lib/image-blob-client'
import { parseVideoStartFrameRef } from '~/lib/video-start-frame-ref'
import { ensureVideoStartFrameUrl, uploadVideoStartFrameFile } from '~/lib/video-start-frame-upload'

const props = withDefaults(
  defineProps<{
    /** Text prompt used when generating a starting frame. */
    prompt: string
    compact?: boolean
    aspectRatio?: string
    /** v-model: staged `/api/generate/video/start-frame/…` URL or remote still URL. */
    frameImageUrl?: string | null
  }>(),
  { compact: false, aspectRatio: '16:9', frameImageUrl: null }
)

const emit = defineEmits<{
  'update:frameImageUrl': [value: string | null]
}>()

const toast = useToast()
const imageModels = CHARACTER_CREATOR_IMAGE_MODELS
const imageModelId = ref(DEFAULT_IMAGE_MODEL_ID)
const generatingFrame = ref(false)
const frameLabel = ref('')
const fileInputEl = ref<HTMLInputElement | null>(null)

const previewUrl = computed(() => props.frameImageUrl || null)

onMounted(async () => {
  const current = props.frameImageUrl
  if (!current?.startsWith('data:')) return
  try {
    const staged = await ensureVideoStartFrameUrl(current)
    if (staged && staged !== current) {
      syncEmit(staged, frameLabel.value || 'Starting frame')
    }
  } catch {
    clearFrame()
    toast.showToast('Previous starting frame was too large — generate or upload again.', 'warning')
  }
})

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
    const url = await uploadVideoStartFrameFile(file)
    syncEmit(url, `Uploaded: ${file.name}`)
    toast.showToast('Starting frame attached.', 'success')
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not upload that image.')
        : 'Could not upload that image.'
    toast.showToast(msg, 'error')
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
    const res = await $fetch<{ urls?: unknown[]; videoStartFrame?: boolean }>('/api/generate/image', {
      method: 'POST',
      body: {
        prompt: p,
        model: imageModelId.value,
        aspectRatio: props.aspectRatio || '16:9',
        purpose: 'video_start_frame'
      }
    })
    const url = firstImageUrlFromGenerateResponse(res.urls || [])
    if (!url) {
      toast.showToast('No image returned — try another model.', 'warning')
      return
    }
    if (!parseVideoStartFrameRef(url) && !res.videoStartFrame) {
      toast.showToast('Image was too large for video — try Flux Klein or Gemini Flash.', 'warning')
      return
    }
    syncEmit(url, `Generated (${imageModelId.value})`)
    toast.showToast('Starting frame ready — generate video when ready.', 'success')
  } catch (e: unknown) {
    const status =
      e && typeof e === 'object' && 'statusCode' in e
        ? (e as { statusCode?: number }).statusCode
        : e && typeof e === 'object' && 'status' in e
          ? (e as { status?: number }).status
          : undefined
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || '')
        : ''
    toast.showToast(
      msg ||
        (status === 413
          ? 'Generated image is too large for video — try Flux Klein or Gemini Flash.'
          : 'Image generation failed'),
      'error'
    )
  } finally {
    generatingFrame.value = false
  }
}
</script>
