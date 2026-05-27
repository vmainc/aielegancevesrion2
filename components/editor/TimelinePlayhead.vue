<template>
  <div
    data-playhead
    class="absolute top-0 bottom-0 z-40 pointer-events-none"
    :style="{ left: `${leftPx}px` }"
  >
    <div
      class="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary pointer-events-auto cursor-grab active:cursor-grabbing"
      @pointerdown.stop="onPointerDown"
    />
    <div
      class="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-4 -ml-2 pointer-events-auto cursor-grab active:cursor-grabbing z-50"
      @pointerdown.stop="onPointerDown"
    />
    <div
      class="absolute top-2 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-primary shadow-[0_0_10px_rgba(45,212,191,0.9)] pointer-events-none"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  leftPx: number
}>()

const emit = defineEmits<{
  scrub: [PointerEvent]
}>()

function onPointerDown (ev: PointerEvent) {
  emit('scrub', ev)
}
</script>
