<template>
  <div
    data-playhead
    class="absolute top-0 bottom-0 z-[100] flex flex-col items-center -translate-x-1/2 touch-none"
    :style="{ left: `${leftPx}px` }"
    title="Drag to scrub — preview updates to this frame"
  >
    <!-- Wide grab rail (above clips) -->
    <div
      class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-5 cursor-grab active:cursor-grabbing"
      :class="scrubbing ? 'cursor-grabbing' : ''"
      @pointerdown.stop="onPointerDown"
    />
    <div
      class="relative z-[2] -top-px px-2 py-0.5 rounded-md bg-primary text-gray-950 text-[10px] font-mono font-semibold tracking-wide shadow-md cursor-grab active:cursor-grabbing select-none"
      :class="scrubbing ? 'ring-2 ring-primary/40 ring-offset-1 ring-offset-zinc-950 cursor-grabbing' : ''"
      @pointerdown.stop="onPointerDown"
    >
      {{ label }}
    </div>
    <div
      class="absolute top-5 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-primary shadow-[0_0_12px_rgba(45,212,191,0.95)] pointer-events-none"
    />
    <div
      class="absolute top-5 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-primary/20 pointer-events-none"
    />
    <div
      class="absolute top-4 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-primary border-2 border-gray-950 shadow pointer-events-none"
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
  if (ev.button !== 0) return
  emit('scrub', ev)
}
</script>
