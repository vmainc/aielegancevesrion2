<template>
  <div class="space-y-1.5">
    <div
      ref="wrapEl"
      class="relative rounded-lg border border-gray-300 bg-studio-slate focus-within:border-primary"
    >
      <div
        ref="backdropEl"
        class="pointer-events-none absolute inset-0 overflow-auto px-3 py-2 text-sm leading-5 whitespace-pre-wrap break-words text-gray-900"
        aria-hidden="true"
      >
        <template
          v-for="(seg, i) in segments"
          :key="i"
        >
          <span v-if="seg.type === 'text'">{{ seg.text }}</span>
          <span
            v-else
            class="rounded-[3px] bg-primary/20 text-gray-900 underline decoration-primary/60 underline-offset-2 pointer-events-auto cursor-default"
            :data-mention-id="seg.mention.characterId"
            @mouseenter="onMentionEnter($event, seg.mention)"
            @mouseleave="onMentionLeave"
            @mousedown.prevent="focusAtMention(seg.mention.start)"
          >{{ seg.text }}</span>
        </template>
        <span v-if="modelValue.endsWith('\n') || !modelValue">&nbsp;</span>
      </div>
      <textarea
        :id="inputId"
        ref="textareaEl"
        :value="modelValue"
        :rows="rows"
        :placeholder="placeholder"
        class="relative z-[1] w-full px-3 py-2 rounded-lg border-0 bg-transparent text-sm leading-5 text-transparent caret-gray-900 selection:bg-primary/25 focus:outline-none resize-y placeholder:text-gray-400"
        spellcheck="true"
        @input="onInput"
        @scroll="syncScroll"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="hoverCard"
        class="fixed z-[200] pointer-events-none w-40 rounded-xl border border-gray-200 bg-studio-slate shadow-lg overflow-hidden"
        :style="{ top: `${hoverCard.top}px`, left: `${hoverCard.left}px` }"
        role="tooltip"
      >
        <div class="aspect-square bg-gray-100">
          <img
            v-if="hoverCard.imageUrl"
            :src="hoverCard.imageUrl"
            :alt="hoverCard.name"
            class="w-full h-full object-cover"
          >
          <div
            v-else
            class="w-full h-full flex items-center justify-center px-2 text-center text-[11px] text-gray-500"
          >
            No reference plate yet
          </div>
        </div>
        <p class="px-2.5 py-1.5 text-[11px] font-semibold text-gray-900 truncate">
          {{ hoverCard.name }}
        </p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  resolveCharacterMentionPreviewUrl,
  segmentPromptWithCharacterMentions,
  type PromptCharacterCastMember,
  type PromptCharacterMention
} from '~/lib/prompt-character-mentions'

const props = withDefaults(
  defineProps<{
    modelValue: string
    characters?: PromptCharacterCastMember[]
    inputId?: string
    rows?: number
    placeholder?: string
  }>(),
  {
    characters: () => [],
    inputId: 'character-aware-prompt',
    rows: 4,
    placeholder: ''
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaEl = ref<HTMLTextAreaElement | null>(null)
const backdropEl = ref<HTMLElement | null>(null)
const wrapEl = ref<HTMLElement | null>(null)

const hoverCard = ref<{
  top: number
  left: number
  name: string
  imageUrl: string | null
} | null>(null)

const segments = computed(() =>
  segmentPromptWithCharacterMentions(props.modelValue, props.characters)
)

const characterById = computed(() => {
  const map = new Map<string, PromptCharacterCastMember>()
  for (const c of props.characters) map.set(c.id, c)
  return map
})

function onInput (event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

function syncScroll () {
  const ta = textareaEl.value
  const bd = backdropEl.value
  if (!ta || !bd) return
  bd.scrollTop = ta.scrollTop
  bd.scrollLeft = ta.scrollLeft
}

function focusAtMention (start: number) {
  const ta = textareaEl.value
  if (!ta) return
  ta.focus()
  ta.setSelectionRange(start, start)
}

function onMentionEnter (event: MouseEvent, mention: PromptCharacterMention) {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const character = characterById.value.get(mention.characterId)
  const cardW = 160
  const gap = 8
  let left = rect.left + rect.width / 2 - cardW / 2
  left = Math.max(8, Math.min(left, window.innerWidth - cardW - 8))
  const preferAbove = rect.top > 200
  const top = preferAbove ? rect.top - gap - 180 : rect.bottom + gap
  hoverCard.value = {
    top: Math.max(8, top),
    left,
    name: character?.name || mention.name,
    imageUrl: resolveCharacterMentionPreviewUrl(character)
  }
}

function onMentionLeave () {
  hoverCard.value = null
}

watch(
  () => props.modelValue,
  async () => {
    await nextTick()
    syncScroll()
  }
)
</script>
