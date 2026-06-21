<template>
  <label
    v-if="editable"
    class="relative block h-11 w-11 mx-auto group"
    :class="[
      disabled || uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer',
    ]"
    :title="portraitUrl ? `Change photo for ${character.name}` : `Upload photo for ${character.name}`"
  >
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="sr-only"
      :disabled="disabled || uploading"
      @change="onFileChange"
    >
    <div
      class="h-11 w-11 rounded-md border bg-gray-50 overflow-hidden flex items-center justify-center transition-colors"
      :class="[
        portraitUrl
          ? 'border-gray-200 group-hover:border-primary/50'
          : 'border-dashed border-gray-300 group-hover:border-primary group-hover:bg-primary/5',
      ]"
    >
      <img
        v-if="portraitUrl"
        :src="portraitUrl"
        :alt="`${character.name} portrait`"
        class="h-full w-full object-cover"
      >
      <span
        v-else
        class="text-[9px] leading-tight text-center font-medium px-0.5"
        :class="uploading ? 'text-gray-400' : 'text-gray-500 group-hover:text-primary'"
      >
        {{ uploading ? '…' : 'Upload' }}
      </span>
    </div>
    <span
      v-if="portraitUrl && !uploading"
      class="absolute inset-x-0 bottom-0 translate-y-full pt-0.5 text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      Change
    </span>
  </label>
  <div
    v-else
    class="h-11 w-11 rounded-md border border-gray-200 bg-gray-50 overflow-hidden mx-auto"
  >
    <img
      v-if="portraitUrl"
      :src="portraitUrl"
      :alt="`${character.name} portrait`"
      class="h-full w-full object-cover"
    >
  </div>
</template>

<script setup lang="ts">
import type { CreativeCharacter } from '~/types/creative-project'

const props = defineProps<{
  character: CreativeCharacter
  portraitUrl: string
  editable?: boolean
  uploading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  pick: [character: CreativeCharacter, file: File]
}>()

function onFileChange (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  emit('pick', props.character, file)
}
</script>
