<template>
  <div>
    <label class="block text-sm font-semibold text-gray-900">{{ label }}</label>
    <p v-if="hint" class="text-xs text-gray-500 mt-0.5 mb-1.5">{{ hint }}</p>
    <textarea
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      :maxlength="maxlength"
      class="w-full rounded-lg border border-gray-300 bg-studio-slate px-3 py-2 text-sm text-gray-800 resize-y focus:outline-none focus:border-primary"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @blur="$emit('commit')"
    />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    modelValue: string
    hint?: string
    placeholder?: string
    rows?: number
    maxlength?: number
  }>(),
  {
    hint: '',
    placeholder: '',
    rows: 3,
    maxlength: 4000
  }
)

defineEmits<{
  'update:modelValue': [value: string]
  commit: []
}>()
</script>
