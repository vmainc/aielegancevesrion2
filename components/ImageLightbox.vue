<template>
  <Teleport to="body">
    <div
      v-if="open && items.length"
      ref="dialogEl"
      class="fixed inset-0 z-[120] bg-black/92 flex flex-col p-4 sm:p-6 pt-16 sm:pt-6"
      role="dialog"
      aria-modal="true"
      :aria-label="current?.title || 'Image preview'"
      tabindex="-1"
      @click.self="close"
      @keydown.escape.prevent="close"
      @keydown.left.prevent="prev"
      @keydown.right.prevent="next"
    >
      <button
        type="button"
        class="absolute top-4 right-4 z-[130] inline-flex items-center gap-2 rounded-full bg-studio-slate pl-3 pr-4 py-2.5 text-sm font-semibold text-gray-900 shadow-lg ring-2 ring-white/40 hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary"
        aria-label="Close image preview"
        @click="close"
      >
        <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Close
      </button>

      <button
        v-if="items.length > 1"
        type="button"
        class="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-[130] inline-flex items-center justify-center w-11 h-11 rounded-full bg-studio-slate/90 text-gray-900 shadow-lg ring-2 ring-white/30 hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary disabled:opacity-40"
        aria-label="Previous image"
        :disabled="items.length < 2"
        @click.stop="prev"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        v-if="items.length > 1"
        type="button"
        class="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-[130] inline-flex items-center justify-center w-11 h-11 rounded-full bg-studio-slate/90 text-gray-900 shadow-lg ring-2 ring-white/30 hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary disabled:opacity-40"
        aria-label="Next image"
        :disabled="items.length < 2"
        @click.stop="next"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div
        class="max-w-6xl w-full mx-auto flex flex-col flex-1 min-h-0"
        @click.stop
      >
        <div class="flex items-center justify-between gap-3 mb-3 shrink-0 pr-28 sm:pr-36">
          <p class="text-sm font-medium text-white truncate min-w-0">
            {{ current?.title || 'Generated image' }}
          </p>
          <p
            v-if="items.length > 1"
            class="text-xs text-white/70 tabular-nums shrink-0"
          >
            {{ index + 1 }} / {{ items.length }}
          </p>
        </div>

        <img
          :src="current?.src || ''"
          :alt="current?.title || 'Generated image'"
          class="w-full flex-1 min-h-[40vh] max-h-[calc(100vh-9rem)] rounded-lg object-contain mx-auto select-none"
          draggable="false"
        >

        <div class="mt-4 flex flex-wrap items-center justify-center gap-3 shrink-0">
          <p class="text-xs sm:text-sm text-white/75 text-center">
            <template v-if="items.length > 1">
              Arrow keys to browse ·
            </template>
            <kbd class="mx-1 rounded border border-white/30 bg-studio-slate/10 px-1.5 py-0.5 font-mono text-[11px] text-white">Esc</kbd>
            to close
          </p>
          <a
            v-if="current?.src"
            :href="current.src"
            target="_blank"
            rel="noopener noreferrer"
            download
            class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-studio-slate/15 hover:bg-studio-slate/25 border border-white/25 text-white"
          >
            Open original
          </a>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
export type ImageLightboxItem = {
  src: string
  title?: string
}

const props = withDefaults(
  defineProps<{
    items: ImageLightboxItem[]
    startIndex?: number
    open?: boolean
  }>(),
  {
    startIndex: 0,
    open: false
  }
)

const emit = defineEmits<{
  close: []
  'update:open': [boolean]
}>()

const dialogEl = ref<HTMLElement | null>(null)
const index = ref(0)

const current = computed(() => props.items[index.value] || null)

watch(
  () => [props.open, props.startIndex, props.items.length] as const,
  ([isOpen, start]) => {
    if (!isOpen) return
    const max = Math.max(0, props.items.length - 1)
    index.value = Math.min(Math.max(0, start), max)
    nextTick(() => dialogEl.value?.focus())
  },
  { immediate: true }
)

function close () {
  emit('update:open', false)
  emit('close')
}

function prev () {
  if (props.items.length < 2) return
  index.value = (index.value - 1 + props.items.length) % props.items.length
}

function next () {
  if (props.items.length < 2) return
  index.value = (index.value + 1) % props.items.length
}

watch(
  () => props.open,
  (isOpen) => {
    if (!import.meta.client) return
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }
)

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>
