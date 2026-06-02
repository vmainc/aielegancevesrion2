<template>
  <div class="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-zinc-900/80 backdrop-blur-sm">
    <button
      v-for="tool in tools"
      :key="tool.id"
      type="button"
      class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      :class="activeTool === tool.id
        ? 'bg-primary text-gray-950 shadow-md'
        : 'text-zinc-300 hover:bg-white/10 hover:text-white'"
      :title="tool.hint"
      @click="$emit('set-tool', tool.id)"
    >
      {{ tool.label }}
    </button>

    <span class="w-px h-6 bg-white/10 mx-1" aria-hidden="true" />

    <button
      type="button"
      class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed"
      :disabled="!canUndo"
      title="Undo (⌘Z)"
      @click="$emit('undo')"
    >
      Undo
    </button>
    <button
      type="button"
      class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed"
      :disabled="!canRedo"
      title="Redo (⌘⇧Z)"
      @click="$emit('redo')"
    >
      Redo
    </button>

    <span class="w-px h-6 bg-white/10 mx-1" aria-hidden="true" />

    <button
      type="button"
      class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-red-500/20 hover:text-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
      :disabled="!hasSelection"
      title="Remove from timeline only — does not delete files in Assets"
      @click="$emit('delete')"
    >
      Remove clip
    </button>

    <div class="relative">
      <button
        type="button"
        class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
        :disabled="!hasSelection"
        @click="showFade = !showFade"
      >
        Fade ▾
      </button>
      <div
        v-if="showFade && hasSelection"
        class="absolute left-0 top-full mt-1 z-30 min-w-[140px] rounded-lg border border-white/10 bg-zinc-900 shadow-xl py-1"
      >
        <button
          v-for="t in fadeOptions"
          :key="t.id"
          type="button"
          class="block w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10"
          @click="pickFade(t)"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <button
      type="button"
      class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
      :disabled="!canDetach"
      title="Move audio to the audio track"
      @click="$emit('detach-audio')"
    >
      Detach Audio
    </button>

    <button
      type="button"
      class="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-950 bg-primary/90 hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
      :disabled="!canBlend"
      title="Crossfade selected clip into the next one"
      @click="$emit('blend')"
    >
      Blend with next
    </button>

    <button
      type="button"
      class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
      :disabled="!canSplit"
      title="Cut selected clip at playhead"
      @click="$emit('split')"
    >
      ✂ Cut at playhead
    </button>

    <div class="ml-auto flex items-center gap-2">
      <label class="text-[10px] uppercase tracking-wide text-zinc-500">Zoom</label>
      <input
        type="range"
        min="16"
        max="120"
        :value="zoom"
        class="w-24 accent-primary"
        @input="onZoom"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TimelineEditorTool, TimelineTransitionType } from '~/types/timeline-editor'

defineProps<{
  activeTool: TimelineEditorTool
  hasSelection: boolean
  canSplit: boolean
  canDetach: boolean
  canBlend: boolean
  canUndo: boolean
  canRedo: boolean
  zoom: number
}>()

const emit = defineEmits<{
  'set-tool': [TimelineEditorTool]
  undo: []
  redo: []
  delete: []
  split: []
  blend: []
  'detach-audio': []
  'set-transition': [which: 'in' | 'out', type: TimelineTransitionType]
  'set-zoom': [number]
}>()

const showFade = ref(false)

const tools: { id: TimelineEditorTool; label: string; hint: string }[] = [
  { id: 'select', label: 'Select (V)', hint: 'Move and trim clips' },
  { id: 'split', label: '✂ Razor (C)', hint: 'Razor tool: click clip to cut at the playhead' }
]

const fadeOptions = [
  { id: 'in-cross', which: 'in' as const, type: 'fade-in' as TimelineTransitionType, label: 'Fade in' },
  { id: 'out-fade', which: 'out' as const, type: 'fade-out' as TimelineTransitionType, label: 'Fade out' },
  { id: 'out-x', which: 'out' as const, type: 'crossfade' as TimelineTransitionType, label: 'Crossfade out' }
]

function pickFade (t: (typeof fadeOptions)[0]) {
  emit('set-transition', t.which, t.type)
  showFade.value = false
}

function onZoom (e: Event) {
  emit('set-zoom', Number((e.target as HTMLInputElement).value))
}
</script>
