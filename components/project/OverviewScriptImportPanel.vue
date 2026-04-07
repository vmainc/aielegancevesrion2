<template>
  <div class="rounded-xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6 mb-5 last:mb-0">
    <h2 class="text-lg font-semibold text-gray-900 mb-1">{{ heading }}</h2>
    <p class="text-sm text-gray-600 mb-4">
      {{ intro }}
    </p>
    <div class="flex flex-wrap items-center gap-3 mb-3">
      <input
        type="file"
        accept=".fdx,.pdf,.txt,text/plain,application/pdf,application/xml,text/xml"
        class="text-sm"
        :disabled="importing || analyzing"
        @change="emit('fileChange', $event)"
      >
      <template v-if="showAspectGoal">
        <label class="text-sm text-gray-600">
          Aspect
          <select
            :value="aspect"
            class="ml-1 px-2 py-1 rounded border border-gray-300 text-sm"
            :disabled="importing || analyzing"
            @change="onAspectChange"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
          </select>
        </label>
        <label class="text-sm text-gray-600">
          Goal
          <select
            :value="goal"
            class="ml-1 px-2 py-1 rounded border border-gray-300 text-sm"
            :disabled="importing || analyzing"
            @change="onGoalChange"
          >
            <option value="film">Film</option>
            <option value="social">Social</option>
            <option value="commercial">Commercial</option>
            <option value="other">Other</option>
          </select>
        </label>
      </template>
      <button
        type="button"
        class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        :disabled="importing || analyzing || !hasFile"
        @click="emit('importClick')"
      >
        {{ importing ? 'Saving…' : saveButtonLabel }}
      </button>
    </div>
    <div v-if="analyzeEnabled" class="border-t border-gray-100 pt-4 mt-2">
      <p class="text-sm text-gray-600 mb-3">
        When you are ready, run AI on the saved file: synopsis, treatment, three-act notes, scenes, characters, and storyboard seed (same as Script Wizard analysis). Large scripts can take many minutes.
      </p>
      <button
        type="button"
        class="px-4 py-2 border border-primary/50 text-primary hover:bg-primary/10 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        :disabled="importing || analyzing"
        @click="emit('analyzeClick')"
      >
        {{ analyzing ? 'Running AI import…' : 'Run treatment & scene import' }}
      </button>
    </div>
    <div
      v-if="importing || analyzing"
      class="mt-4 rounded-xl border border-primary/25 bg-gray-50 p-6"
    >
      <FilmReelLoader
        size="md"
        :label="analyzing ? 'Running AI import' : 'Saving screenplay'"
        :sub-label="analyzing
          ? 'Enrichment, scenes, characters, treatment — stay on this page.'
          : 'Uploading file to project assets…'"
      />
    </div>
    <p v-if="error" class="mt-3 text-sm text-red-700">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const ASPECT = ['16:9', '9:16', '1:1'] as const
const GOALS = ['film', 'social', 'commercial', 'other'] as const

type Aspect = (typeof ASPECT)[number]
type Goal = (typeof GOALS)[number]

withDefaults(
  defineProps<{
    heading?: string
    intro?: string
    saveButtonLabel?: string
    showAspectGoal?: boolean
    importing: boolean
    analyzing: boolean
    analyzeEnabled: boolean
    error: string
    hasFile: boolean
  }>(),
  {
    heading: 'Screenplay',
    intro:
      'Step 1: choose a file and save it to this project\'s assets (no AI yet). Step 2: run treatment & scene import when you are ready.',
    saveButtonLabel: 'Save screenplay to project',
    showAspectGoal: true
  }
)

const aspect = defineModel<Aspect>('aspect', { required: true })
const goal = defineModel<Goal>('goal', { required: true })

const emit = defineEmits<{
  fileChange: [e: Event]
  importClick: []
  analyzeClick: []
}>()

function onAspectChange (e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if ((ASPECT as readonly string[]).includes(v)) {
    aspect.value = v as Aspect
  }
}

function onGoalChange (e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if ((GOALS as readonly string[]).includes(v)) {
    goal.value = v as Goal
  }
}
</script>
