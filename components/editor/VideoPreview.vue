<template>
  <div class="rounded-xl border border-white/10 bg-black/80 overflow-hidden shadow-2xl">
    <div
      class="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden"
      :class="scrubbing ? 'ring-2 ring-primary/50 ring-inset' : ''"
    >
      <template v-if="hasClips">
        <video
          ref="videoRefA"
          class="absolute inset-0 w-full h-full object-contain transition-opacity duration-75"
          playsinline
          preload="auto"
          muted
        />
        <video
          ref="videoRefB"
          class="absolute inset-0 w-full h-full object-contain transition-opacity duration-75"
          playsinline
          preload="auto"
          muted
          style="opacity: 0"
        />
      </template>
      <p v-else class="text-sm text-zinc-500 px-6 text-center relative z-10">
        Add clips from Video or drag them on the timeline — preview syncs with the playhead.
      </p>
      <div
        v-if="scrubbing"
        class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-primary/90 text-[10px] font-semibold text-gray-950"
      >
        Scrubbing — drag timeline to preview frames
      </div>
      <div
        v-else-if="blendLabel"
        class="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-md bg-violet-500/80 text-[10px] font-medium text-white"
      >
        {{ blendLabel }}
      </div>
      <div
        v-if="activeLabel"
        class="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-md bg-black/70 text-xs text-zinc-200 border border-white/10 max-w-[70%] truncate"
      >
        {{ activeLabel }}
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-white/10 bg-zinc-900/90">
      <button
        type="button"
        class="h-9 w-9 rounded-full bg-primary text-gray-950 flex items-center justify-center hover:bg-primary/90 transition-colors"
        :aria-label="playing ? 'Pause' : 'Play'"
        @click="$emit('toggle-play')"
      >
        <span v-if="playing" class="text-sm font-bold">❚❚</span>
        <span v-else class="text-sm ml-0.5">▶</span>
      </button>
      <button
        type="button"
        class="h-8 px-2 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/10"
        @click="$emit('stop')"
      >
        Stop
      </button>
      <span class="text-xs font-mono text-zinc-300 tabular-nums">
        {{ timecodeCurrent }}
        <span class="text-zinc-600">/</span>
        {{ timecodeDuration }}
      </span>
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  hasClips: boolean
  playing: boolean
  scrubbing?: boolean
  timecodeCurrent: string
  timecodeDuration: string
  activeLabel?: string
  blendLabel?: string
}>()

defineEmits<{
  'toggle-play': []
  stop: []
}>()

const videoRefA = ref<HTMLVideoElement | null>(null)
const videoRefB = ref<HTMLVideoElement | null>(null)

defineExpose({
  videoRefA,
  videoRefB
})
</script>
