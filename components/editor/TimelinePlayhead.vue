<template>
  <div
    data-playhead
    class="absolute top-0 bottom-0 z-[60] pointer-events-none"
    :style="{ left: `${leftPx}px` }"
    title="Drag to scrub through the timeline"
  >
    <div
      class="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-primary text-gray-950 text-[10px] font-mono font-semibold tracking-wide shadow-md pointer-events-auto cursor-grab active:cursor-grabbing"
      :class="scrubbing ? 'ring-2 ring-primary/40 ring-offset-1 ring-offset-zinc-950' : ''"
      @pointerdown.stop="onPointerDown"
    >
      {{ label }}
    </div>
    <div
      class="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-5 -ml-2.5 pointer-events-auto cursor-grab active:cursor-grabbing z-50"
      @pointerdown.stop="onPointerDown"
    />
    <div
      class="absolute top-5 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-primary shadow-[0_0_12px_rgba(45,212,191,0.95)] pointer-events-none"
    />
    <div
      class="absolute top-5 bottom-0 left-1/2 -translate-x-1/2 w-6 bg-primary/10 pointer-events-none"
    />
    <div
      class="absolute top-4 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-primary border border-gray-950 pointer-events-none"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  leftPx: number
  label?: string
  scrubbing?: boolean
}>()

const label = computed(() => props.label || '--:--')
const scrubbing = computed(() => Boolean(props.scrubbing))

const emit = defineEmits<{
  scrub: [PointerEvent]
}>()

function onPointerDown (ev: PointerEvent) {
  emit('scrub', ev)
}
</script>
