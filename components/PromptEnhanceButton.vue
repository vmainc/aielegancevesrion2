<template>
  <button
    type="button"
    class="inline-flex items-center gap-1 sm:gap-1.5 shrink-0 px-2 py-1 rounded-md text-xs font-medium text-gray-600 hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-colors disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-transparent"
    :title="loading ? 'Enhancing…' : 'Enhance prompt (Claude)'"
    :disabled="disabled || loading || !trimmed"
    :aria-busy="loading"
    @click="run"
  >
    <!-- Quill -->
    <svg
      class="w-4 h-4 text-gray-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
    <span class="hidden sm:inline">Enhance</span>
    <!-- Sparkles -->
    <svg
      v-if="!loading"
      class="w-3.5 h-3.5 text-amber-500/90"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
      />
    </svg>
    <svg
      v-if="loading"
      class="w-3.5 h-3.5 animate-spin text-primary"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string
    context?:
      | 'character'
      | 'video'
      | 'image'
      | 'concept'
      | 'director'
      | 'continuity'
      | 'story'
      | 'shot_image'
      | 'shot_video'
      | 'question'
      | 'comment'
      | 'general'
    fieldHint?: string
    disabled?: boolean
  }>(),
  {
    context: 'general',
    fieldHint: undefined,
    disabled: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const toast = useToast()
const loading = ref(false)

const trimmed = computed(() => (typeof props.modelValue === 'string' ? props.modelValue.trim() : ''))

async function run () {
  if (!trimmed.value || loading.value) return
  loading.value = true
  try {
    const res = await $fetch<{ enhanced: string }>('/api/prompt/enhance', {
      method: 'POST',
      body: {
        prompt: props.modelValue,
        context: props.context,
        fieldHint: props.fieldHint
      }
    })
    emit('update:modelValue', res.enhanced)
    toast.showToast('Prompt enhanced.', 'success')
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? '')
        : e instanceof Error
          ? e.message
          : 'Enhance failed'
    toast.showToast(msg.slice(0, 240), 'error')
  } finally {
    loading.value = false
  }
}
</script>
