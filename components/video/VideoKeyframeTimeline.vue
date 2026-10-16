<template>
  <div class="rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-xs font-medium text-gray-700">
          Shot timeline
          <span class="font-normal text-gray-500">(optional)</span>
        </p>
        <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
          Drop stills along the clip so generation hits each beat. First and last images lock start/end frames;
          middle beats guide motion between them.
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 bg-studio-slate text-gray-800 hover:bg-gray-50 disabled:opacity-40"
        :disabled="keyframes.length >= maxKeyframes"
        @click="addBeat"
      >
        + Add beat
      </button>
    </div>

    <!-- Track -->
    <div class="space-y-2">
      <div
        ref="trackEl"
        class="relative h-16 rounded-lg border border-gray-200 bg-studio-slate cursor-crosshair select-none"
        role="listbox"
        aria-label="Keyframe timeline"
        @click="onTrackClick"
      >
        <div
          class="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-gray-200 rounded-full"
          aria-hidden="true"
        />
        <button
          v-for="kf in sortedKeyframes"
          :key="kf.id"
          type="button"
          role="option"
          class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          :style="{ left: `${percentFor(kf.atSeconds)}%` }"
          :aria-selected="selectedId === kf.id"
          :title="formatKeyframeTimeLabel(kf.atSeconds, durationSeconds)"
          @click.stop="selectedId = kf.id"
        >
          <span
            class="block w-11 h-11 rounded-md overflow-hidden border-2 bg-gray-100 shadow-sm transition-transform group-hover:scale-105"
            :class="selectedId === kf.id
              ? 'border-primary ring-2 ring-primary/30'
              : hasImage(kf) ? 'border-gray-300' : 'border-dashed border-gray-400'"
          >
            <img
              v-if="hasImage(kf)"
              :src="kf.imageUrl!"
              alt=""
              class="w-full h-full object-cover"
            >
            <span
              v-else
              class="flex h-full w-full items-center justify-center text-[10px] font-semibold text-gray-500"
            >+</span>
          </span>
        </button>
      </div>
      <div class="flex justify-between text-[10px] font-medium text-gray-500 px-0.5">
        <span>0s</span>
        <span>{{ durationSeconds }}s</span>
      </div>
    </div>

    <!-- Selected beat editor -->
    <div
      v-if="selected"
      class="rounded-lg border border-gray-200 bg-studio-slate p-3 space-y-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs font-semibold text-gray-800">
          {{ formatKeyframeTimeLabel(selected.atSeconds, durationSeconds) }}
        </p>
        <div class="flex items-center gap-2">
          <label class="inline-flex items-center gap-1.5 text-[11px] text-gray-600">
            At
            <input
              :value="selected.atSeconds"
              type="number"
              min="0"
              :max="durationSeconds"
              step="0.5"
              class="w-16 px-1.5 py-1 rounded border border-gray-300 bg-studio-slate text-gray-900 text-xs"
              @change="onTimeChange"
            >
            s
          </label>
          <button
            v-if="keyframes.length > 2"
            type="button"
            class="text-[11px] font-medium text-gray-600 hover:text-red-700"
            @click="removeSelected"
          >
            Remove beat
          </button>
        </div>
      </div>

      <VideoStartFramePicker
        :key="selected.id"
        :frame-image-url="selected.imageUrl || null"
        :role="pickerRole"
        :title-override="pickerTitle"
        compact
        :prompt="frameGeneratePrompt"
        :aspect-ratio="aspectRatio"
        :bible-project-id="bibleProjectId"
        :bible-scene-id="bibleSceneId"
        :bible-shot-id="bibleShotId"
        :bible-character-ids="bibleCharacterIds"
        :reference-image-urls="referenceImageUrls"
        @update:frame-image-url="onFrameUrl"
      />

      <div>
        <label
          :for="`vg-kf-note-${selected.id}`"
          class="block text-[11px] font-medium text-gray-600 mb-1"
        >
          Beat note
        </label>
        <input
          :id="`vg-kf-note-${selected.id}`"
          :value="selected.note || ''"
          type="text"
          maxlength="240"
          class="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-xs focus:outline-none focus:border-primary"
          placeholder="e.g. camera pushes in as she turns toward the door"
          @input="onNoteInput"
        >
      </div>
    </div>

    <p
      v-if="supportsEndFrame === false"
      class="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2"
    >
      This model only locks the starting frame. Later beats still guide the prompt (and mid stills as references when supported).
    </p>
    <p
      v-else-if="endFrameCompatibilityWarn"
      class="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2"
    >
      {{ endFrameCompatibilityHint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  addTimelineKeyframe,
  formatKeyframeTimeLabel,
  removeTimelineKeyframe,
  sortTimelineKeyframes,
  updateTimelineKeyframe,
  type VideoTimelineKeyframe
} from '~/lib/video-keyframe-timeline'

const props = withDefaults(
  defineProps<{
    keyframes: VideoTimelineKeyframe[]
    durationSeconds: number
    prompt: string
    aspectRatio?: string
    bibleProjectId?: string
    bibleSceneId?: string
    bibleShotId?: string
    bibleCharacterIds?: string[]
    referenceImageUrls?: string[]
    supportsEndFrame?: boolean
    endFrameCompatibilityWarn?: boolean
    endFrameCompatibilityHint?: string
    maxKeyframes?: number
  }>(),
  {
    aspectRatio: '16:9',
    bibleCharacterIds: () => [],
    referenceImageUrls: () => [],
    supportsEndFrame: true,
    endFrameCompatibilityWarn: false,
    endFrameCompatibilityHint: '',
    maxKeyframes: 6
  }
)

const emit = defineEmits<{
  'update:keyframes': [value: VideoTimelineKeyframe[]]
}>()

const trackEl = ref<HTMLElement | null>(null)
const selectedId = ref<string | null>(null)

const sortedKeyframes = computed(() => sortTimelineKeyframes(props.keyframes))

const selected = computed(() =>
  sortedKeyframes.value.find(k => k.id === selectedId.value) || sortedKeyframes.value[0] || null
)

watch(
  sortedKeyframes,
  (list) => {
    if (!list.length) {
      selectedId.value = null
      return
    }
    if (!selectedId.value || !list.some(k => k.id === selectedId.value)) {
      selectedId.value = list[0].id
    }
  },
  { immediate: true }
)

const pickerRole = computed<'start' | 'end' | 'beat'>(() => {
  const s = selected.value
  if (!s) return 'start'
  if (s.atSeconds <= 0.05) return 'start'
  if (Math.abs(s.atSeconds - props.durationSeconds) < 0.05) return 'end'
  return 'beat'
})

const pickerTitle = computed(() => {
  const s = selected.value
  if (!s) return ''
  return formatKeyframeTimeLabel(s.atSeconds, props.durationSeconds)
})

const frameGeneratePrompt = computed(() => {
  const base = props.prompt.trim()
  const s = selected.value
  if (!s) return base
  const note = (s.note || '').trim()
  const label = formatKeyframeTimeLabel(s.atSeconds, props.durationSeconds)
  const beat = note
    ? `Keyframe at ${label}: ${note}`
    : `Keyframe still at ${label} in this shot — clear story beat for image-to-video.`
  return base ? `${base}\n\n${beat}` : beat
})

function hasImage (kf: VideoTimelineKeyframe): boolean {
  return Boolean((kf.imageUrl || '').trim())
}

function percentFor (at: number): number {
  const dur = Math.max(1, props.durationSeconds)
  const pct = (at / dur) * 100
  return Math.max(4, Math.min(96, pct))
}

function commit (next: VideoTimelineKeyframe[]) {
  emit('update:keyframes', next)
}

function addBeat () {
  if (props.keyframes.length >= props.maxKeyframes) return
  const next = addTimelineKeyframe(props.keyframes, props.durationSeconds)
  const added = next.find(k => !props.keyframes.some(p => p.id === k.id))
  commit(next)
  if (added) selectedId.value = added.id
}

function removeSelected () {
  const id = selected.value?.id
  if (!id) return
  commit(removeTimelineKeyframe(props.keyframes, id))
}

function onFrameUrl (url: string | null) {
  const id = selected.value?.id
  if (!id) return
  commit(updateTimelineKeyframe(props.keyframes, id, { imageUrl: url }, props.durationSeconds))
}

function onNoteInput (event: Event) {
  const id = selected.value?.id
  if (!id) return
  const note = (event.target as HTMLInputElement).value
  commit(updateTimelineKeyframe(props.keyframes, id, { note }, props.durationSeconds))
}

function onTimeChange (event: Event) {
  const id = selected.value?.id
  if (!id) return
  const raw = Number((event.target as HTMLInputElement).value)
  commit(updateTimelineKeyframe(props.keyframes, id, { atSeconds: raw }, props.durationSeconds))
}

function onTrackClick (event: MouseEvent) {
  const el = trackEl.value
  if (!el || props.keyframes.length >= props.maxKeyframes) return
  const rect = el.getBoundingClientRect()
  const x = event.clientX - rect.left
  const ratio = Math.max(0, Math.min(1, x / rect.width))
  const at = ratio * props.durationSeconds
  const next = addTimelineKeyframe(props.keyframes, props.durationSeconds, at)
  const added = next.find(k => !props.keyframes.some(p => p.id === k.id))
  commit(next)
  if (added) selectedId.value = added.id
}
</script>
