<template>
  <div
    ref="rootEl"
    class="w-full max-w-[min(100%,20rem)] sm:max-w-xs rounded-lg border border-gray-200 overflow-hidden bg-black shrink-0"
  >
    <video
      v-if="shouldLoad && src"
      :key="src"
      ref="videoEl"
      :src="src"
      class="w-full aspect-video object-contain"
      controls
      playsinline
      preload="metadata"
    />
    <div
      v-else
      class="w-full aspect-video flex items-center justify-center bg-gray-950"
      aria-hidden="true"
    >
      <span class="text-[11px] text-gray-500 px-3 text-center">
        Scroll into view to load preview
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Defers setting video `src` until the tile is near the viewport.
 * Closed &lt;details&gt; groups stay unloaded so Assets → Video does not hammer the network.
 */
const props = defineProps<{
  src: string
}>()

const rootEl = ref<HTMLElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const shouldLoad = ref(false)

let observer: IntersectionObserver | null = null

function stopPlayback () {
  const v = videoEl.value
  if (!v) return
  try {
    v.pause()
    v.removeAttribute('src')
    v.load()
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  if (!import.meta.client || !rootEl.value) return
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.some(e => e.isIntersecting)
      if (visible) {
        shouldLoad.value = true
      } else if (shouldLoad.value) {
        shouldLoad.value = false
        nextTick(() => stopPlayback())
      }
    },
    { root: null, rootMargin: '120px 0px', threshold: 0.01 }
  )
  observer.observe(rootEl.value)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
  stopPlayback()
})

watch(
  () => props.src,
  () => {
    if (!shouldLoad.value) return
    shouldLoad.value = false
    nextTick(() => {
      shouldLoad.value = true
    })
  }
)
</script>
