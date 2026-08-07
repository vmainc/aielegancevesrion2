<template>
  <div ref="rootEl" class="relative space-y-2">
    <div
      class="flex flex-wrap items-center gap-1.5 min-h-[2.5rem] px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white focus-within:border-primary"
      @click="focusInput"
    >
      <span
        v-for="c in selectedCharacters"
        :key="c.id"
        class="inline-flex items-center gap-1 max-w-full pl-2 pr-1 py-0.5 rounded-md bg-gray-100 text-gray-900 text-xs font-medium"
      >
        <span class="truncate">{{ c.name }}</span>
        <button
          type="button"
          class="shrink-0 p-0.5 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-200"
          :aria-label="`Remove ${c.name}`"
          @click.stop="remove(c.id)"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
      <input
        :id="inputId"
        ref="inputEl"
        v-model="query"
        type="text"
        role="combobox"
        :aria-expanded="menuOpen"
        aria-autocomplete="list"
        :aria-controls="listboxId"
        autocomplete="off"
        class="flex-1 min-w-[8rem] border-0 bg-transparent py-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
        :placeholder="selectedCharacters.length ? 'Add another…' : placeholder"
        @focus="onFocus"
        @keydown="onKeydown"
        @input="onInput"
      >
    </div>

    <div
      v-if="menuOpen"
      :id="listboxId"
      role="listbox"
      class="absolute left-0 right-0 z-50 rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto"
    >
      <button
        v-for="(c, i) in filteredSuggestions"
        :key="c.id"
        type="button"
        role="option"
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
        :class="i === highlightIndex ? 'bg-primary/5 text-gray-900' : 'text-gray-800'"
        @pointerdown.prevent.stop="add(c.id)"
        @mouseenter="highlightIndex = i"
      >
        <span class="truncate font-medium">{{ c.name }}</span>
        <span v-if="c.badge" class="shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
          {{ c.badge }}
        </span>
      </button>
      <p
        v-if="!filteredSuggestions.length"
        class="px-3 py-2.5 text-xs text-gray-500"
      >
        <template v-if="query.trim()">
          No cast match for “{{ query.trim() }}”.
        </template>
        <template v-else-if="availableCount">
          Type a name to search {{ availableCount }} cast member{{ availableCount === 1 ? '' : 's' }}.
        </template>
        <template v-else>
          No more cast to add.
        </template>
      </p>
    </div>

    <p v-if="hint" class="text-xs text-gray-500">
      {{ hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
export type CharacterTypeaheadOption = {
  id: string
  name: string
  /** Shown in empty-query suggestions (e.g. scene matches). */
  suggested?: boolean
  badge?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: CharacterTypeaheadOption[]
    placeholder?: string
    hint?: string
    inputId?: string
  }>(),
  {
    placeholder: 'Type a character name…',
    hint: '',
    inputId: 'character-typeahead'
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const rootEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const query = ref('')
const menuOpen = ref(false)
const highlightIndex = ref(0)
const listboxId = computed(() => `${props.inputId}-listbox`)

const selectedSet = computed(() => new Set(props.modelValue))

const selectedCharacters = computed(() => {
  const byId = new Map(props.options.map(o => [o.id, o]))
  return props.modelValue
    .map(id => byId.get(id))
    .filter((c): c is CharacterTypeaheadOption => Boolean(c))
})

const available = computed(() =>
  props.options.filter(o => !selectedSet.value.has(o.id))
)

const availableCount = computed(() => available.value.length)

const filteredSuggestions = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = available.value
  if (q) {
    list = list.filter(o => o.name.toLowerCase().includes(q))
  } else {
    // Empty query: only show suggested (in-scene / prompt hits), not the whole cast.
    const suggested = list.filter(o => o.suggested)
    list = suggested.length ? suggested : []
  }
  return list.slice(0, 8)
})

watch(filteredSuggestions, () => {
  highlightIndex.value = 0
})

function focusInput () {
  inputEl.value?.focus()
}

function onFocus () {
  menuOpen.value = true
}

function onInput () {
  menuOpen.value = true
}

function add (id: string) {
  if (selectedSet.value.has(id)) return
  emit('update:modelValue', [...props.modelValue, id])
  query.value = ''
  highlightIndex.value = 0
  menuOpen.value = true
  nextTick(() => inputEl.value?.focus())
}

function remove (id: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter(x => x !== id)
  )
}

function onKeydown (e: KeyboardEvent) {
  const list = filteredSuggestions.value

  // Always stop Enter from submitting the parent video generate form.
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    const pick = list[highlightIndex.value]
    if (pick) add(pick.id)
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    menuOpen.value = true
    if (!list.length) return
    highlightIndex.value = (highlightIndex.value + 1) % list.length
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    menuOpen.value = true
    if (!list.length) return
    highlightIndex.value = (highlightIndex.value - 1 + list.length) % list.length
    return
  }
  if (e.key === 'Escape') {
    menuOpen.value = false
    query.value = ''
    return
  }
  if (e.key === 'Backspace' && !query.value && props.modelValue.length) {
    remove(props.modelValue[props.modelValue.length - 1]!)
  }
}

function onDocumentPointerDown (e: PointerEvent) {
  const t = e.target as Node | null
  if (!t || !rootEl.value) return
  if (!rootEl.value.contains(t)) menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>
