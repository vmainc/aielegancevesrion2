<template>
  <div class="flex border-b border-white/5 last:border-b-0">
    <div
      class="w-24 shrink-0 flex items-center px-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 border-r border-white/5 bg-zinc-950/50"
    >
      {{ label }}
    </div>
    <div
      ref="laneRef"
      class="relative flex-1 min-h-[56px] bg-zinc-900/40"
      :style="{ width: `${laneWidthPx}px`, minWidth: '100%' }"
    >
      <EditorTimelineClip
        v-for="(clip, idx) in clips"
        :key="clip.id"
        :clip="clip"
        :left-px="timeToPx(clip.timelineStart, pxPerSec)"
        :width-px="Math.max(24, timeToPx(clip.duration, pxPerSec))"
        :overlap-out-px="overlapOutPx(clip, idx)"
        :selected="clip.id === selectedClipId"
        :active-tool="activeTool"
        :dragging="clip.id === draggingClipId"
        @select="$emit('select-clip', clip.id)"
        @remove="$emit('remove-clip', clip.id)"
        @drag-start="(ev) => $emit('clip-drag-start', clip.id, ev)"
        @scrub-seek="(ev) => $emit('clip-scrub-seek', ev)"
        @trim-start="(side, ev) => $emit('clip-trim-start', clip.id, side, ev)"
      />
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { clipTransitionDuration } from '~/lib/timeline-editor/blend'
import { timeToPx } from '~/lib/timeline-editor/geometry'
import type { TimelineEditorClip, TimelineEditorTool } from '~/types/timeline-editor'

const props = defineProps<{
  label: string
  clips: TimelineEditorClip[]
  laneWidthPx: number
  pxPerSec: number
  selectedClipId: string | null
  activeTool: TimelineEditorTool
  draggingClipId: string | null
}>()

const emit = defineEmits<{
  'select-clip': [id: string]
  'remove-clip': [id: string]
  'clip-drag-start': [id: string, ev: PointerEvent]
  'clip-scrub-seek': [ev: PointerEvent]
  'clip-trim-start': [id: string, side: 'left' | 'right', ev: PointerEvent]
}>()

const laneRef = ref<HTMLElement | null>(null)

function overlapOutPx (clip: TimelineEditorClip, idx: number): number {
  if (clip.transitionOut !== 'crossfade') return 0
  const next = props.clips[idx + 1]
  if (!next || next.transitionIn !== 'crossfade') return 0
  return timeToPx(clipTransitionDuration(clip), props.pxPerSec)
}

defineExpose({ laneRef })
</script>
