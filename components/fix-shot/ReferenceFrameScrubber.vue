<template>
  <div class="rounded-xl border border-gray-200 bg-black overflow-hidden">
    <div class="relative aspect-video bg-black">
      <video
        ref="videoEl"
        :src="src"
        class="w-full h-full object-contain"
        playsinline
        preload="metadata"
        muted
        @loadedmetadata="onMeta"
        @seeked="onSeeked"
        @timeupdate="onTime"
      />
      <div
        v-if="previewUrl"
        class="absolute inset-0 pointer-events-none border-t border-primary/40"
      >
        <img
          :src="previewUrl"
          alt="Selected reference frame"
          class="w-full h-full object-contain opacity-0"
        >
      </div>
    </div>
    <div class="px-4 py-3 bg-studio-slate border-t border-gray-200 space-y-2">
      <div class="flex items-center justify-between gap-3">
        <p class="text-[11px] font-semibold uppercase tracking-cinema text-gray-500">
          Reference frame
        </p>
        <p class="font-mono text-sm text-primary">
          {{ timecode }}
        </p>
      </div>
      <input
        type="range"
        min="0"
        :max="duration || 0"
        :step="0.1"
        :value="current"
        class="w-full accent-primary"
        :disabled="!duration"
        @input="onScrub"
      >
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-gray-950 hover:bg-primary/90 disabled:opacity-40"
          :disabled="busy || !duration"
          @click="useThisFrame"
        >
          {{ busy ? 'Extracting…' : 'Use this frame as reference' }}
        </button>
        <label class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-800 hover:border-primary/50 cursor-pointer">
          Upload reference image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="sr-only"
            @change="onUpload"
          >
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatTimecode } from '~/lib/video-repair/limits'

const props = defineProps<{
  src: string
  busy?: boolean
}>()

const emit = defineEmits<{
  extract: [blob: Blob, timestampSeconds: number]
  upload: [file: File]
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const duration = ref(0)
const current = ref(0)
const previewUrl = ref('')

const timecode = computed(() => formatTimecode(current.value))

function onMeta () {
  const v = videoEl.value
  if (!v) return
  duration.value = Number.isFinite(v.duration) ? v.duration : 0
}

function onTime () {
  const v = videoEl.value
  if (!v) return
  current.value = v.currentTime
}

function onSeeked () {
  onTime()
}

function onScrub (e: Event) {
  const v = videoEl.value
  if (!v) return
  const t = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(t)) return
  v.currentTime = t
  current.value = t
}

function captureFrame (): Promise<Blob> {
  const v = videoEl.value
  if (!v) return Promise.reject(new Error('No video'))
  const canvas = document.createElement('canvas')
  canvas.width = v.videoWidth || 1280
  canvas.height = v.videoHeight || 720
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('No canvas'))
  ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not capture frame'))),
      'image/jpeg',
      0.92
    )
  })
}

async function useThisFrame () {
  const blob = await captureFrame()
  emit('extract', blob, current.value)
}

function onUpload (e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('upload', file)
}
</script>
