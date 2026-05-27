<template>
  <div
    data-clip-block
    class="absolute top-1 bottom-1 rounded-lg border transition-shadow duration-150 select-none overflow-hidden group"
    :class="[
      clip.type === 'video'
        ? 'bg-gradient-to-br from-primary/35 to-teal-900/50 border-primary/40'
        : 'bg-gradient-to-br from-violet-900/50 to-zinc-800/80 border-violet-500/30',
      selected ? 'ring-2 ring-primary shadow-lg shadow-primary/20 z-20' : 'hover:border-white/30 z-10',
      dragging ? 'opacity-90 shadow-xl scale-[1.02]' : ''
    ]"
    :style="{ left: `${leftPx}px`, width: `${widthPx}px` }"
    :title="clip.label"
    @pointerdown.stop="onClipPointerDown"
  >
    <!-- Trim handles (select tool) -->
    <div
      v-if="activeTool === 'select'"
      class="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/20 z-30"
      @pointerdown.stop="onTrimStart('left', $event)"
    />
    <div
      v-if="activeTool === 'select'"
      class="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/20 z-30"
      @pointerdown.stop="onTrimStart('right', $event)"
    />

    <!-- Crossfade overlap tail -->
    <div
      v-if="overlapOutPx > 0"
      class="absolute top-0 bottom-0 right-0 pointer-events-none z-0"
      :style="{ width: `${overlapOutPx}px` }"
    >
      <div class="h-full w-full bg-gradient-to-r from-transparent via-primary/25 to-primary/45 rounded-r-lg" />
    </div>

    <div class="px-2 py-1 h-full flex flex-col justify-center min-w-0 pointer-events-none relative z-[1]">
      <p class="text-[10px] font-semibold text-white truncate">
        {{ clip.label }}
      </p>
      <p class="text-[9px] text-white/60 font-mono">
        {{ clip.duration.toFixed(1) }}s
      </p>
      <div
        v-if="clip.track === 'audio'"
        class="mt-1 flex gap-px h-3 items-end opacity-70"
        aria-hidden="true"
      >
        <span
          v-for="n in 12"
          :key="n"
          class="flex-1 bg-violet-300/50 rounded-sm"
          :style="{ height: `${20 + (n % 5) * 12}%` }"
        />
      </div>
      <div v-if="transitionLabel" class="text-[8px] text-primary/90 mt-0.5 truncate">
        {{ transitionLabel }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TimelineEditorClip, TimelineEditorTool } from '~/types/timeline-editor'

const props = defineProps<{
  clip: TimelineEditorClip
  leftPx: number
  widthPx: number
  overlapOutPx?: number
  selected: boolean
  activeTool: TimelineEditorTool
  dragging: boolean
}>()

const overlapOutPx = computed(() => props.overlapOutPx ?? 0)

const emit = defineEmits<{
  select: []
  'drag-start': [PointerEvent]
  'trim-start': [side: 'left' | 'right', ev: PointerEvent]
}>()

const transitionLabel = computed(() => {
  const parts: string[] = []
  if (props.clip.transitionIn) parts.push(`↗ ${props.clip.transitionIn}`)
  if (props.clip.transitionOut) parts.push(`↘ ${props.clip.transitionOut}`)
  return parts.join(' ')
})

function onClipPointerDown (ev: PointerEvent) {
  emit('select')
  if (props.activeTool === 'select') {
    emit('drag-start', ev)
  }
}

function onTrimStart (side: 'left' | 'right', ev: PointerEvent) {
  emit('trim-start', side, ev)
}
</script>
