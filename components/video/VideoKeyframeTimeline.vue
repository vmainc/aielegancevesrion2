<template>
  <div class="rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-4">
    <div class="min-w-0">
      <p class="text-xs font-medium text-gray-700">
        Start &amp; end frames
        <span class="font-normal text-gray-500">(optional)</span>
      </p>
      <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
        Start (and end, when supported) lock the clip as image-to-video.
        Write the motion in the Prompt above — not in per-beat notes.
      </p>
    </div>

    <div
      class="grid gap-3"
      :class="supportsEndFrame ? 'sm:grid-cols-2' : 'grid-cols-1'"
    >
      <div
        class="rounded-lg border bg-studio-slate p-3 space-y-2"
        :class="selectedId === startKeyframe?.id
          ? 'border-primary ring-1 ring-primary/25'
          : 'border-gray-200'"
      >
        <button
          type="button"
          class="text-left w-full"
          @click="selectKeyframe(startKeyframe?.id)"
        >
          <p class="text-[11px] font-semibold text-gray-800">
            Start · 0s
          </p>
        </button>
        <VideoStartFramePicker
          v-if="startKeyframe"
          :key="startKeyframe.id"
          :frame-image-url="startKeyframe.imageUrl || null"
          role="start"
          title-override="Start · 0s"
          compact
          :prompt="frameGeneratePromptFor(startKeyframe)"
          :aspect-ratio="aspectRatio"
          :bible-project-id="bibleProjectId"
          :bible-scene-id="bibleSceneId"
          :bible-shot-id="bibleShotId"
          :bible-character-ids="bibleCharacterIds"
          :reference-image-urls="referenceImageUrls"
          :set-reference-image-urls="setReferenceImageUrls"
          :cast-continuity-block="castContinuityBlock"
          @update:frame-image-url="url => onFrameUrl(startKeyframe!.id, url)"
        />
      </div>

      <div
        v-if="supportsEndFrame && endKeyframe"
        class="rounded-lg border bg-studio-slate p-3 space-y-2"
        :class="selectedId === endKeyframe.id
          ? 'border-primary ring-1 ring-primary/25'
          : 'border-gray-200'"
      >
        <button
          type="button"
          class="text-left w-full"
          @click="selectKeyframe(endKeyframe.id)"
        >
          <p class="text-[11px] font-semibold text-gray-800">
            End · {{ durationSeconds }}s
          </p>
        </button>
        <VideoStartFramePicker
          :key="endKeyframe.id"
          :frame-image-url="endKeyframe.imageUrl || null"
          role="end"
          :title-override="`End · ${durationSeconds}s`"
          compact
          :prompt="frameGeneratePromptFor(endKeyframe)"
          :aspect-ratio="aspectRatio"
          :bible-project-id="bibleProjectId"
          :bible-scene-id="bibleSceneId"
          :bible-shot-id="bibleShotId"
          :bible-character-ids="bibleCharacterIds"
          :reference-image-urls="referenceImageUrls"
          :set-reference-image-urls="setReferenceImageUrls"
          :cast-continuity-block="castContinuityBlock"
          @update:frame-image-url="url => onFrameUrl(endKeyframe.id, url)"
        />
      </div>
    </div>

    <p
      v-if="supportsEndFrame === false"
      class="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2"
    >
      This model only locks the starting frame. End frame is unavailable.
    </p>
    <p
      v-else-if="endFrameCompatibilityWarn"
      class="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2"
    >
      {{ endFrameCompatibilityHint }}
    </p>

    <div class="border-t border-gray-200 pt-4 space-y-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs font-medium text-gray-700">
            Mid beats
            <span class="font-normal text-gray-500">(optional)</span>
          </p>
          <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
            Text cues only — timing notes appended to the prompt.
            They do not insert extra stills into the render (most models only take start/end images).
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

      <p
        v-if="!midKeyframes.length"
        class="text-[11px] text-gray-500"
      >
        No mid beats. Add one if you want a timed cue between start and end.
      </p>

      <ul
        v-else
        class="space-y-2"
      >
        <li
          v-for="kf in midKeyframes"
          :key="kf.id"
          class="rounded-lg border border-gray-200 bg-studio-slate p-3 space-y-2"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label class="inline-flex items-center gap-1.5 text-[11px] text-gray-600">
              At
              <input
                :value="kf.atSeconds"
                type="number"
                min="0.5"
                :max="Math.max(0.5, durationSeconds - 0.5)"
                step="0.5"
                class="w-16 px-1.5 py-1 rounded border border-gray-300 bg-studio-slate text-gray-900 text-xs"
                @change="onMidTimeChange(kf.id, $event)"
              >
              s
            </label>
            <button
              type="button"
              class="text-[11px] font-medium text-gray-600 hover:text-red-700"
              @click="removeBeat(kf.id)"
            >
              Remove
            </button>
          </div>
          <input
            :value="kf.note || ''"
            type="text"
            maxlength="240"
            class="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-xs focus:outline-none focus:border-primary"
            placeholder="e.g. he turns from the doorway toward the screen"
            @input="onNoteInput(kf.id, $event)"
          >
        </li>
      </ul>
    </div>
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
    setReferenceImageUrls?: string[]
    castContinuityBlock?: string
    supportsEndFrame?: boolean
    endFrameCompatibilityWarn?: boolean
    endFrameCompatibilityHint?: string
    maxKeyframes?: number
  }>(),
  {
    aspectRatio: '16:9',
    bibleCharacterIds: () => [],
    referenceImageUrls: () => [],
    setReferenceImageUrls: () => [],
    castContinuityBlock: '',
    supportsEndFrame: true,
    endFrameCompatibilityWarn: false,
    endFrameCompatibilityHint: '',
    maxKeyframes: 6
  }
)

const emit = defineEmits<{
  'update:keyframes': [value: VideoTimelineKeyframe[]]
}>()

const selectedId = ref<string | null>(null)

const sortedKeyframes = computed(() => sortTimelineKeyframes(props.keyframes))

const startKeyframe = computed(() =>
  sortedKeyframes.value.find(k => k.atSeconds <= 0.05) || sortedKeyframes.value[0] || null
)

const endKeyframe = computed(() => {
  const dur = props.durationSeconds
  return (
    sortedKeyframes.value.find(k => Math.abs(k.atSeconds - dur) < 0.05) ||
    sortedKeyframes.value[sortedKeyframes.value.length - 1] ||
    null
  )
})

const midKeyframes = computed(() =>
  sortedKeyframes.value.filter((k) => {
    if (startKeyframe.value && k.id === startKeyframe.value.id) return false
    if (endKeyframe.value && k.id === endKeyframe.value.id) return false
    return true
  })
)

watch(
  sortedKeyframes,
  (list) => {
    if (!list.length) {
      selectedId.value = null
      return
    }
    if (!selectedId.value || !list.some(k => k.id === selectedId.value)) {
      selectedId.value = startKeyframe.value?.id || list[0].id
    }
  },
  { immediate: true }
)

/** Mid beats must stay text-only — strip stray images from older sessions. */
watch(
  () => props.keyframes,
  (frames) => {
    const dur = props.durationSeconds
    let dirty = false
    const next = frames.map((f) => {
      const isStart = f.atSeconds <= 0.05
      const isEnd = Math.abs(f.atSeconds - dur) < 0.05
      if (!isStart && !isEnd && (f.imageUrl || '').trim()) {
        dirty = true
        return { ...f, imageUrl: null }
      }
      return f
    })
    if (dirty) emit('update:keyframes', sortTimelineKeyframes(next))
  },
  { immediate: true, deep: true }
)

function selectKeyframe (id: string | undefined) {
  if (id) selectedId.value = id
}

function frameGeneratePromptFor (kf: VideoTimelineKeyframe): string {
  const base = props.prompt.trim()
  const note = (kf.note || '').trim()
  const label = formatKeyframeTimeLabel(kf.atSeconds, props.durationSeconds)
  const beat = note
    ? `Keyframe at ${label}: ${note}`
    : `Keyframe still at ${label} in this shot — clear story beat for image-to-video.`
  return base ? `${base}\n\n${beat}` : beat
}

function commit (next: VideoTimelineKeyframe[]) {
  emit('update:keyframes', next)
}

function addBeat () {
  if (props.keyframes.length >= props.maxKeyframes) return
  const next = addTimelineKeyframe(props.keyframes, props.durationSeconds).map((f) => {
    const isStart = f.atSeconds <= 0.05
    const isEnd = Math.abs(f.atSeconds - props.durationSeconds) < 0.05
    if (!isStart && !isEnd) return { ...f, imageUrl: null }
    return f
  })
  const added = next.find(k => !props.keyframes.some(p => p.id === k.id))
  commit(next)
  if (added) selectedId.value = added.id
}

function removeBeat (id: string) {
  commit(removeTimelineKeyframe(props.keyframes, id))
}

function onFrameUrl (id: string, url: string | null) {
  commit(updateTimelineKeyframe(props.keyframes, id, { imageUrl: url }, props.durationSeconds))
}

function onNoteInput (id: string, event: Event) {
  const note = (event.target as HTMLInputElement).value
  commit(updateTimelineKeyframe(props.keyframes, id, { note }, props.durationSeconds))
}

function onMidTimeChange (id: string, event: Event) {
  const raw = Number((event.target as HTMLInputElement).value)
  const clamped = Math.max(0.5, Math.min(props.durationSeconds - 0.5, raw))
  commit(updateTimelineKeyframe(props.keyframes, id, { atSeconds: clamped }, props.durationSeconds))
}
</script>
