<template>
  <div
    class="rounded-lg border border-gray-200 bg-gray-50/80 space-y-3"
    :class="compact ? 'p-3' : 'p-4'"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs font-medium text-gray-700">
        {{ titleLabel }}
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
      {{ helpText }}
      Frames are compressed to fit video limits (~900KB).
    </p>
    <p v-else class="text-[11px] text-gray-500 leading-snug">
      {{ compactHelpText }}
    </p>

    <div
      v-if="previewUrl"
      class="rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0"
      :class="compact ? 'w-20 h-20' : 'w-28 h-28'"
    >
      <img
        :src="previewUrl"
        :alt="`${titleLabel} preview`"
        class="w-full h-full object-cover"
      >
    </div>

    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
          :class="frameMode === 'upload'
            ? 'bg-primary text-gray-950 hover:bg-primary/90'
            : 'bg-studio-slate border border-gray-300 text-gray-800 hover:bg-gray-50'"
          @click="chooseUpload"
        >
          Choose file
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
          :class="frameMode === 'generate'
            ? 'bg-primary text-gray-950 hover:bg-primary/90'
            : 'bg-studio-slate border border-gray-300 text-gray-800 hover:bg-gray-50'"
          @click="frameMode = 'generate'"
        >
          Generate
        </button>
        <input
          ref="fileInputEl"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="sr-only"
          @change="onFileChange"
        >
      </div>

      <div
        v-if="frameMode === 'generate'"
        class="rounded-lg border border-gray-200 bg-studio-slate p-3 space-y-2"
      >
        <div>
          <label
            :for="imageModelSelectId"
            class="block text-[11px] font-medium text-gray-600 mb-1"
          >
            Image model
          </label>
          <select
            :id="imageModelSelectId"
            v-model="imageModelId"
            class="w-full px-2 py-1.5 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-xs"
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
          class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-gray-950 hover:bg-primary/90 disabled:opacity-50"
          :disabled="generatingFrame || !prompt.trim()"
          @click="generateFrame"
        >
          {{ generatingFrame ? 'Generating…' : compact ? 'Generate frame' : generateButtonLabel }}
        </button>
        <p
          v-if="referenceImageUrls.length"
          class="text-[11px] text-gray-600"
        >
          Matching {{ referenceImageUrls.length }} cast plate{{ referenceImageUrls.length === 1 ? '' : 's' }} as character reference{{ referenceImageUrls.length === 1 ? '' : 's' }}.
        </p>
        <p v-if="!prompt.trim()" class="text-[11px] text-gray-500">
          Add a video prompt above first.
        </p>
      </div>

      <p v-else-if="frameMode === 'upload' && !frameImageUrl" class="text-[11px] text-gray-500">
        JPEG, PNG, WebP, or GIF — pick a file from your computer.
      </p>

      <p v-if="frameLabel" class="text-[11px] text-gray-600">
        {{ frameLabel }}
      </p>
      <p
        v-if="bibleDebugLine"
        class="text-[11px] text-sky-800 bg-sky-50 border border-sky-100 rounded px-2 py-1"
      >
        {{ bibleDebugLine }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  appendProductionBibleToPrompt,
  mergeProductionBibleGenerationOptions,
  productionBibleGenerationDebugLabel
} from '~/lib/production-bible-generation-context'
import {
  CHARACTER_CREATOR_IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL_ID
} from '~/lib/character-creator-models'
import { firstImageUrlFromGenerateResponse } from '~/lib/image-blob-client'
import { parseVideoStartFrameRef } from '~/lib/video-start-frame-ref'
import { pocketBaseBearerHeaders } from '~/lib/pocketbase-auth-headers'
import { ensureVideoStartFrameUrl, uploadVideoStartFrameFile } from '~/lib/video-start-frame-upload'

const PB_ID = /^[a-z0-9]{15}$/

const props = withDefaults(
  defineProps<{
    /** Text prompt used when generating a starting frame. */
    prompt: string
    compact?: boolean
    aspectRatio?: string
    /** v-model: staged `/api/generate/video/start-frame/…` URL or remote still URL. */
    frameImageUrl?: string | null
    /** Start (first) vs end (last) frame labels/toasts. Staging pipeline is shared. */
    role?: 'start' | 'end'
    /** When set, Production Bible context is appended to the generate prompt (fail-open). */
    bibleProjectId?: string
    bibleSceneId?: string
    bibleShotId?: string
    bibleCharacterIds?: string[]
    /**
     * Cast isolation plates to attach when generating a seed frame
     * (featured + turnarounds from Assets → Characters / cast lookbook).
     */
    referenceImageUrls?: string[]
  }>(),
  {
    compact: false,
    aspectRatio: '16:9',
    frameImageUrl: null,
    role: 'start',
    bibleCharacterIds: () => [],
    referenceImageUrls: () => []
  }
)

const emit = defineEmits<{
  'update:frameImageUrl': [value: string | null]
}>()

const toast = useToast()
const { getAuthToken } = useAuth()
const imageModels = CHARACTER_CREATOR_IMAGE_MODELS
const imageModelId = ref(DEFAULT_IMAGE_MODEL_ID)
const generatingFrame = ref(false)
const frameLabel = ref('')
const fileInputEl = ref<HTMLInputElement | null>(null)
const frameMode = ref<'upload' | 'generate'>('upload')
const bibleDebugLine = ref('')

const isEndFrame = computed(() => props.role === 'end')
const titleLabel = computed(() => (isEndFrame.value ? 'Ending frame' : 'Starting frame'))
const helpText = computed(() =>
  isEndFrame.value
    ? 'Upload or generate where the clip should land. Models that support last-frame control (Veo, Kling, Seedance, Wan 2.7) interpolate from start toward this image.'
    : 'Upload a still (default) or generate one from your prompt. Video models use this as the first frame (image-to-video).'
)
const compactHelpText = computed(() =>
  isEndFrame.value
    ? 'Optional ending still — where the scene should finish.'
    : 'Upload a still or generate from your prompt when no storyboard frame is set.'
)
const generateButtonLabel = computed(() =>
  isEndFrame.value ? 'Generate ending frame' : 'Generate starting frame'
)
const imageModelSelectId = computed(() => {
  const role = isEndFrame.value ? 'end' : 'start'
  return props.compact ? `vg-frame-image-model-${role}-compact` : `vg-frame-image-model-${role}`
})
const attachedToast = computed(() =>
  isEndFrame.value ? 'Ending frame attached.' : 'Starting frame attached.'
)
const readyToast = computed(() =>
  isEndFrame.value
    ? 'Ending frame ready — generate video when ready.'
    : 'Starting frame ready — generate video when ready.'
)
const oversizedToast = computed(() =>
  isEndFrame.value
    ? 'Previous ending frame was too large — generate or upload again.'
    : 'Previous starting frame was too large — generate or upload again.'
)

const bibleProjectRef = computed(() => props.bibleProjectId || '')
const productionBible = useProductionBible(bibleProjectRef)

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
    toast.showToast(oversizedToast.value, 'warning')
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

function chooseUpload () {
  frameMode.value = 'upload'
  fileInputEl.value?.click()
}

async function onFileChange (event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.showToast('Choose an image file (JPEG, PNG, WebP, or GIF).', 'warning')
    return
  }
  frameMode.value = 'upload'
  try {
    const url = await uploadVideoStartFrameFile(file)
    syncEmit(url, `Uploaded: ${file.name}`)
    toast.showToast(attachedToast.value, 'success')
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
  bibleDebugLine.value = ''
  try {
    let promptForApi = p
    if (isEndFrame.value) {
      promptForApi = `${p}\n\nComposition note: create a final still that shows where this shot ends — resolved action, resting pose, or landing composition suitable as the last video frame.`
    }
    if (props.bibleProjectId && PB_ID.test(props.bibleProjectId)) {
      const ctx = await productionBible.loadContextForPrompt(
        mergeProductionBibleGenerationOptions({
          sceneId: props.bibleSceneId || undefined,
          shotId: props.bibleShotId || undefined,
          characterIds: props.bibleCharacterIds?.length ? props.bibleCharacterIds : undefined
        })
      )
      bibleDebugLine.value = productionBibleGenerationDebugLabel(ctx)
      promptForApi = appendProductionBibleToPrompt(promptForApi, ctx)
    }
    const res = await $fetch<{ urls?: unknown[]; videoStartFrame?: boolean }>('/api/generate/image', {
      method: 'POST',
      headers: pocketBaseBearerHeaders(getAuthToken()),
      body: {
        prompt: promptForApi,
        model: imageModelId.value,
        aspectRatio: props.aspectRatio || '16:9',
        purpose: 'video_start_frame',
        ...(props.referenceImageUrls?.length
          ? {
              referenceImageUrls: props.referenceImageUrls.slice(0, 4),
              referenceImageUrl: props.referenceImageUrls[0]
            }
          : {})
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
    frameMode.value = 'generate'
    syncEmit(url, `Generated (${imageModelId.value})`)
    toast.showToast(readyToast.value, 'success')
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
