<template>
  <div class="rounded-xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6 mb-5 last:mb-0">
    <template v-if="!hideUploadStep">
      <h2 class="text-lg font-semibold text-gray-900 mb-1">{{ heading }}</h2>
      <p class="text-sm text-gray-600 mb-4">
        {{ intro }}
      </p>
    </template>
    <p v-else class="text-sm text-gray-700 mb-4">
      {{ intro }}
    </p>
    <div v-if="!hideUploadStep" class="flex flex-wrap items-center gap-3 mb-3">
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
    <div
      v-if="analyzeEnabled"
      :class="[
        hideUploadStep ? 'pt-0' : 'border-t border-gray-100 pt-4 mt-2',
        prominentAnalyze && 'rounded-xl p-4 sm:p-5 bg-primary/10 ring-2 ring-primary/55 ring-offset-2 ring-offset-white'
      ]"
    >
      <p
        v-if="prominentAnalyze"
        class="text-xs font-bold uppercase tracking-wide text-primary mb-2"
      >
        Next step — press this button
      </p>
      <p class="text-sm text-gray-600 mb-3">
        {{
          hideUploadStep
            ? 'Synopsis, treatment, three-act notes, and director bible (Overview + Director tab). Cast, scenes, and storyboard are separate steps — tweak director notes, then use those tabs. Large scripts can take many minutes — stay on this page.'
            : 'When you are ready, run AI on the saved file: synopsis, treatment, three-act notes, and director bible. Generate cast, scene breakdown, and storyboard panels from the Characters, Scenes, and Storyboard tabs after you refine notes.'
        }}
      </p>
      <button
        type="button"
        :class="prominentAnalyze
          ? 'w-full sm:w-auto px-6 py-3.5 bg-primary hover:bg-primary/90 text-gray-950 rounded-xl text-base font-bold transition-colors disabled:opacity-50 shadow-md'
          : 'px-4 py-2 border border-primary/50 text-primary hover:bg-primary/10 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50'"
        :disabled="importing || analyzing"
        @click="emit('analyzeClick')"
      >
        {{ analyzing ? 'Running director analysis…' : 'Run director analysis' }}
      </button>
    </div>
    <div
      v-if="importing || analyzing"
      class="mt-4 rounded-xl border border-primary/25 bg-gray-50 p-6"
    >
      <FilmReelLoader
        size="md"
        :label="analyzing ? 'Running director analysis' : 'Saving screenplay'"
        :sub-label="analyzing
          ? 'Synopsis, treatment, three-act notes, director bible — stay on this page.'
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
    /** After save: show only import CTA (no file row). */
    hideUploadStep?: boolean
    /** Larger primary button for the analyze action. */
    prominentAnalyze?: boolean
    importing: boolean
    analyzing: boolean
    analyzeEnabled: boolean
    error: string
    hasFile: boolean
  }>(),
  {
    heading: 'Screenplay',
    intro:
      'Step 1: choose a file and save it to this project\'s assets (no AI yet). Step 2: run director analysis when you are ready — then refine notes and generate cast, scenes, and storyboard from their tabs.',
    saveButtonLabel: 'Save screenplay to project',
    showAspectGoal: true,
    hideUploadStep: false,
    prominentAnalyze: false
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
