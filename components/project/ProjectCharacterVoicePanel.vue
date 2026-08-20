<template>
  <div
    v-if="characters.length"
    class="rounded-xl border border-gray-200 bg-studio-slate p-5 sm:p-6 mb-8 shadow-sm"
  >
    <h2 class="text-lg font-semibold text-gray-900 mb-1">
      Cast voice & performance references
    </h2>
    <p class="text-sm text-gray-600 mb-6">
      Upload short speaking clips (~10 seconds) or small video clips for mannerisms and on-camera delivery.
      These are reference samples only and do not replace your original dialogue.
    </p>

    <ul class="space-y-5">
      <li
        v-for="c in characters"
        :key="c.id"
        class="rounded-lg border border-gray-200 bg-gray-50/60 p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-2 mb-3">
          <h3 class="text-sm font-semibold text-gray-900">
            {{ c.name }}
          </h3>
          <label
            v-if="editable"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-studio-slate text-gray-800 hover:border-primary hover:text-primary cursor-pointer transition-colors"
            :class="uploadingCharacterId === c.id ? 'opacity-60 pointer-events-none' : ''"
          >
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,video/mp4,video/webm,video/quicktime,.mp4,.mov"
              class="sr-only"
              :disabled="busy || uploadingCharacterId === c.id"
              @change="onFileChange(c, $event)"
            >
            {{ uploadingCharacterId === c.id ? 'Uploading…' : 'Add clip' }}
          </label>
        </div>

        <div class="mb-3">
          <label class="block text-xs font-medium text-gray-600 mb-1">
            Voice notes
            <span class="font-normal text-gray-400">(tone, pace, accent)</span>
          </label>
          <textarea
            v-if="editable"
            :value="voiceNotesDraft[c.id] ?? c.voiceDescription ?? ''"
            rows="2"
            maxlength="2000"
            class="w-full rounded-lg border border-gray-300 bg-studio-slate px-3 py-2 text-sm text-gray-800 resize-y"
            placeholder="e.g. Low, deliberate; slight rasp; Midwestern flat."
            :disabled="busy || savingNotesCharacterId === c.id"
            @input="onNotesInput(c.id, ($event.target as HTMLTextAreaElement).value)"
          />
          <p
            v-else
            class="text-sm text-gray-700 whitespace-pre-wrap"
          >
            {{ c.voiceDescription?.trim() || '—' }}
          </p>
          <div
            v-if="editable && notesDirty(c)"
            class="flex flex-wrap gap-2 mt-2"
          >
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
              :disabled="busy || savingNotesCharacterId === c.id"
              @click="saveNotes(c)"
            >
              {{ savingNotesCharacterId === c.id ? 'Saving…' : 'Save voice notes' }}
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-studio-slate disabled:opacity-50"
              :disabled="busy || savingNotesCharacterId === c.id"
              @click="revertNotes(c)"
            >
              Cancel
            </button>
          </div>
        </div>

        <div v-if="samplesFor(c.id).length" class="space-y-2">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Samples ({{ samplesFor(c.id).length }})
          </p>
          <ul class="space-y-2">
            <li
              v-for="sample in samplesFor(c.id)"
              :key="sample.assetId"
              class="flex flex-col gap-2 rounded-lg border border-gray-200 bg-studio-slate px-3 py-2"
            >
              <video
                v-if="sample.mediaType === 'video'"
                :src="sample.url"
                controls
                preload="metadata"
                playsinline
                class="w-full max-h-36 rounded bg-black"
              />
              <audio
                v-else
                :src="sample.url"
                controls
                preload="metadata"
                class="h-8 max-w-full min-w-[12rem] flex-1"
              />
              <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-gray-400 truncate max-w-[8rem]">
                {{ sample.mannerismLabel || sample.title }}
                <span v-if="sample.mediaType === 'video'" class="text-primary"> · video</span>
              </span>
              <button
                v-if="editable"
                type="button"
                class="text-xs font-medium text-red-700 hover:underline disabled:opacity-40 shrink-0"
                :disabled="busy || deletingAssetId === sample.assetId"
                @click="requestDeleteSample(c, sample.assetId)"
              >
                {{ deletingAssetId === sample.assetId ? 'Removing…' : 'Remove' }}
              </button>
              </div>
            </li>
          </ul>
        </div>
        <p
          v-else
          class="text-xs text-gray-500"
        >
          No reference clips yet. Upload a short MP3/WAV or a ~10s MP4/WebM of this character speaking or moving.
        </p>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { CharacterReferenceClip } from '~/lib/character-voice-assets'
import type { CreativeCharacter } from '~/types/creative-project'

const props = withDefaults(
  defineProps<{
    characters: CreativeCharacter[]
    samplesByCharacterId: Record<string, CharacterReferenceClip[]>
    editable?: boolean
    busy?: boolean
    uploadingCharacterId?: string | null
    deletingAssetId?: string | null
    savingNotesCharacterId?: string | null
  }>(),
  {
    editable: false,
    busy: false,
    uploadingCharacterId: null,
    deletingAssetId: null,
    savingNotesCharacterId: null
  }
)

const emit = defineEmits<{
  upload: [payload: { characterId: string; file: File }]
  deleteSample: [payload: { characterId: string; assetId: string }]
  saveVoiceNotes: [payload: { characterId: string; voiceDescription: string }]
}>()

const voiceNotesDraft = reactive<Record<string, string>>({})

function samplesFor (characterId: string): CharacterReferenceClip[] {
  return props.samplesByCharacterId[characterId] || []
}

function onFileChange (c: CreativeCharacter, ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  emit('upload', { characterId: c.id, file })
}

function onNotesInput (characterId: string, value: string) {
  voiceNotesDraft[characterId] = value
}

function notesDirty (c: CreativeCharacter): boolean {
  const draft = voiceNotesDraft[c.id]
  if (draft === undefined) return false
  return draft !== (c.voiceDescription || '')
}

function saveNotes (c: CreativeCharacter) {
  const text = (voiceNotesDraft[c.id] ?? c.voiceDescription ?? '').trim()
  emit('saveVoiceNotes', { characterId: c.id, voiceDescription: text })
}

function revertNotes (c: CreativeCharacter) {
  delete voiceNotesDraft[c.id]
}

function requestDeleteSample (c: CreativeCharacter, assetId: string) {
  if (!globalThis.confirm(`Remove this voice clip for ${c.name}?`)) return
  emit('deleteSample', { characterId: c.id, assetId })
}

watch(
  () => props.characters,
  (list) => {
    for (const c of list) {
      if (voiceNotesDraft[c.id] !== undefined && voiceNotesDraft[c.id] === (c.voiceDescription || '')) {
        delete voiceNotesDraft[c.id]
      }
    }
  },
  { deep: true }
)
</script>
