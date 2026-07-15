<template>
  <Teleport to="body">
    <div
      v-if="frame"
      ref="dialogEl"
      class="fixed inset-0 z-[110] bg-black/92 flex flex-col p-4 sm:p-6 pt-16 sm:pt-6"
      role="dialog"
      aria-modal="true"
      :aria-label="`Preview: ${frame.title}`"
      tabindex="-1"
      @click.self="emit('close')"
      @keydown.escape="emit('close')"
    >
      <button
        type="button"
        class="absolute top-4 right-4 z-[120] inline-flex items-center gap-2 rounded-full bg-white pl-3 pr-4 py-2.5 text-sm font-semibold text-gray-900 shadow-lg ring-2 ring-white/40 hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary"
        aria-label="Close image preview"
        @click="emit('close')"
      >
        <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Close
      </button>

      <div
        class="max-w-6xl w-full mx-auto flex flex-col flex-1 min-h-0"
        @click.stop
      >
        <p class="text-sm font-medium text-white truncate mb-3 shrink-0 pr-28 sm:pr-36">
          {{ frame.title }}
        </p>
        <img
          :src="frame.url"
          :alt="frame.title"
          class="w-full flex-1 min-h-[40vh] max-h-[calc(100vh-8rem)] rounded-lg object-contain mx-auto"
        >
        <div class="mt-4 flex flex-wrap items-center justify-center gap-3 shrink-0">
          <p class="text-xs sm:text-sm text-white/75 text-center">
            Press
            <kbd class="mx-1 rounded border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">Esc</kbd>
            or click the dark area outside the image
          </p>
          <a
            v-if="frame.downloadUrl"
            :href="frame.downloadUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
export type StoryboardFramePreview = {
  title: string
  url: string
  downloadUrl?: string
}

defineProps<{
  frame: StoryboardFramePreview | null
}>()

const emit = defineEmits<{
  close: []
}>()

const dialogEl = ref<HTMLElement | null>(null)

watch(
  () => dialogEl.value,
  (el) => {
    if (el) el.focus()
  }
)
</script>
