<template>
  <div class="relative h-11 w-11 mx-auto">
    <button
      v-if="portraitUrl"
      type="button"
      class="block h-11 w-11 rounded-md border border-gray-200 bg-gray-50 overflow-hidden transition-shadow hover:ring-2 hover:ring-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-zoom-in disabled:opacity-60"
      :disabled="uploading"
      :title="`View ${character.name} portrait`"
      :aria-label="`Enlarge portrait for ${character.name}`"
      @click.stop="emit('preview', character)"
    >
      <img
        :src="portraitUrl"
        :alt="`${character.name} portrait`"
        class="h-full w-full object-cover pointer-events-none"
      >
    </button>

    <label
      v-else-if="editable"
      class="relative block h-11 w-11 group"
      :class="[
        disabled || uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer',
      ]"
      :title="`Upload photo for ${character.name}`"
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        class="sr-only"
        :disabled="disabled || uploading"
        @change="onFileChange"
      >
      <div
        class="h-11 w-11 rounded-md border border-dashed border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center transition-colors group-hover:border-primary group-hover:bg-primary/5"
      >
        <span
          class="text-[9px] leading-tight text-center font-medium px-0.5"
          :class="uploading ? 'text-gray-400' : 'text-gray-500 group-hover:text-primary'"
        >
          {{ uploading ? '…' : 'Upload' }}
        </span>
      </div>
    </label>

    <div
      v-else
      class="h-11 w-11 rounded-md border border-gray-200 bg-gray-50 overflow-hidden"
    />

    <label
      v-if="portraitUrl && editable"
      class="absolute inset-x-0 -bottom-4 text-center cursor-pointer"
      :class="disabled || uploading ? 'pointer-events-none opacity-50' : ''"
      :title="`Change photo for ${character.name}`"
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        class="sr-only"
        :disabled="disabled || uploading"
        @change="onFileChange"
      >
      <span class="text-[9px] text-gray-400 hover:text-primary">
        {{ uploading ? '…' : 'Change' }}
      </span>
    </label>
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
  preview: [character: CreativeCharacter]
}>()

function onFileChange (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  emit('pick', props.character, file)
}
</script>
