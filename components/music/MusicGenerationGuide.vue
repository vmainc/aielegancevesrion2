<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-gray-600">
        Step {{ stepIndex + 1 }} of {{ steps.length }}
      </p>
      <button
        v-if="step !== 'purpose'"
        type="button"
        class="text-sm text-gray-500 hover:text-gray-800"
        :disabled="busy"
        @click="goBack"
      >
        Back
      </button>
    </div>

    <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div
        class="h-full bg-primary transition-all duration-300 ease-out"
        :style="{ width: `${progressPct}%` }"
      />
    </div>

    <!-- Purpose -->
    <section v-if="step === 'purpose'" class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">What are you making?</h2>
        <p class="mt-1 text-sm text-gray-500">We’ll tailor the score prompt from your answer.</p>
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        <button
          v-for="opt in purposeOptions"
          :key="opt.id"
          type="button"
          class="text-left rounded-xl border px-4 py-3 transition-colors"
          :class="brief.purpose === opt.id
            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
            : 'border-gray-200 bg-white hover:border-gray-300'"
          @click="brief.purpose = opt.id"
        >
          <span class="block text-sm font-medium text-gray-900">{{ opt.label }}</span>
          <span class="block text-xs text-gray-500 mt-0.5">{{ opt.hint }}</span>
        </button>
      </div>
      <div v-if="brief.purpose === 'other'">
        <label for="mg-guide-purpose-other" class="block text-sm font-medium text-gray-700 mb-1.5">
          Describe it
        </label>
        <input
          id="mg-guide-purpose-other"
          v-model="brief.purposeOther"
          type="text"
          maxlength="200"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
          placeholder="e.g. podcast intro sting"
        >
      </div>
    </section>

    <!-- Length -->
    <section v-else-if="step === 'length'" class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">How long should it be?</h2>
        <p class="mt-1 text-sm text-gray-500">This picks Lyria Clip vs Pro.</p>
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        <button
          v-for="opt in lengthOptions"
          :key="opt.id"
          type="button"
          class="text-left rounded-xl border px-4 py-3 transition-colors"
          :class="brief.length === opt.id
            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
            : 'border-gray-200 bg-white hover:border-gray-300'"
          @click="brief.length = opt.id"
        >
          <span class="block text-sm font-medium text-gray-900">{{ opt.label }}</span>
          <span class="block text-xs text-gray-500 mt-0.5">{{ opt.hint }}</span>
        </button>
      </div>
    </section>

    <!-- Vocals -->
    <section v-else-if="step === 'vocals'" class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">Vocals?</h2>
        <p class="mt-1 text-sm text-gray-500">Instrumental beds are usually best under picture.</p>
      </div>
      <div class="grid gap-2">
        <button
          v-for="opt in vocalOptions"
          :key="opt.id"
          type="button"
          class="text-left rounded-xl border px-4 py-3 transition-colors"
          :class="brief.vocals === opt.id
            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
            : 'border-gray-200 bg-white hover:border-gray-300'"
          @click="brief.vocals = opt.id"
        >
          <span class="block text-sm font-medium text-gray-900">{{ opt.label }}</span>
          <span class="block text-xs text-gray-500 mt-0.5">{{ opt.hint }}</span>
        </button>
      </div>
      <div v-if="brief.vocals === 'own_lyrics'">
        <label for="mg-guide-own-lyrics" class="block text-sm font-medium text-gray-700 mb-1.5">
          Your lyrics
        </label>
        <textarea
          id="mg-guide-own-lyrics"
          v-model="brief.ownLyrics"
          rows="5"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
          placeholder="Paste or write lyrics here…"
        />
      </div>
    </section>

    <!-- Mood -->
    <section v-else-if="step === 'mood'" class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">Mood & style</h2>
        <p class="mt-1 text-sm text-gray-500">Pick a chip or write your own description.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in moodChips"
          :key="chip"
          type="button"
          class="px-3 py-1.5 text-xs rounded-full border transition-colors"
          :class="brief.mood === chip
            ? 'border-primary bg-primary/10 text-gray-900'
            : 'border-gray-300 bg-white text-gray-700 hover:border-primary/50'"
          @click="brief.mood = chip"
        >
          {{ chip }}
        </button>
      </div>
      <div>
        <label for="mg-guide-mood" class="block text-sm font-medium text-gray-700 mb-1.5">
          Describe the sound
        </label>
        <textarea
          id="mg-guide-mood"
          v-model="brief.mood"
          rows="3"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
          placeholder="e.g. low strings, sparse piano, building dread"
        />
      </div>
      <div>
        <label for="mg-guide-bpm" class="block text-sm font-medium text-gray-700 mb-1.5">
          BPM <span class="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="mg-guide-bpm"
          v-model.number="brief.bpm"
          type="number"
          min="40"
          max="220"
          placeholder="e.g. 90"
          class="w-full max-w-[10rem] px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
        >
      </div>
    </section>

    <!-- Save -->
    <section v-else-if="step === 'save'" class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">Save to a project?</h2>
        <p class="mt-1 text-sm text-gray-500">
          Saved tracks show under
          <NuxtLink to="/assets/music" class="text-primary font-medium hover:underline">Assets → My Music</NuxtLink>.
        </p>
      </div>
      <label class="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
        <input
          v-model="brief.saveToProject"
          type="checkbox"
          class="rounded border-gray-300 text-primary focus:ring-primary"
        >
        Save when generation finishes
      </label>
      <div v-if="brief.saveToProject" class="space-y-3">
        <div class="flex flex-wrap gap-2 items-end">
          <div class="flex-1 min-w-[12rem]">
            <label for="mg-guide-project" class="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
            <select
              id="mg-guide-project"
              v-model="brief.projectId"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
            >
              <option value="">Select a project…</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
          </div>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 border border-primary/30 rounded-lg hover:bg-primary/5"
            @click="emit('create-project')"
          >
            + New project
          </button>
        </div>
      </div>
    </section>

    <!-- Review -->
    <section v-else class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">Ready to generate</h2>
        <p class="mt-1 text-sm text-gray-500">Here’s what we’ll send to Lyria. You can edit in Manual anytime.</p>
      </div>
      <dl class="rounded-xl border border-gray-200 bg-gray-50/80 divide-y divide-gray-200 text-sm">
        <div class="px-4 py-3 flex justify-between gap-4">
          <dt class="text-gray-500 shrink-0">Purpose</dt>
          <dd class="text-gray-900 text-right">{{ purposeSummary }}</dd>
        </div>
        <div class="px-4 py-3 flex justify-between gap-4">
          <dt class="text-gray-500 shrink-0">Length</dt>
          <dd class="text-gray-900 text-right">{{ lengthSummary }}</dd>
        </div>
        <div class="px-4 py-3 flex justify-between gap-4">
          <dt class="text-gray-500 shrink-0">Vocals</dt>
          <dd class="text-gray-900 text-right">{{ vocalsSummary }}</dd>
        </div>
        <div class="px-4 py-3 flex justify-between gap-4">
          <dt class="text-gray-500 shrink-0">Mood</dt>
          <dd class="text-gray-900 text-right">{{ brief.mood || '—' }}</dd>
        </div>
        <div v-if="brief.bpm" class="px-4 py-3 flex justify-between gap-4">
          <dt class="text-gray-500 shrink-0">BPM</dt>
          <dd class="text-gray-900 text-right">{{ brief.bpm }}</dd>
        </div>
        <div class="px-4 py-3 flex justify-between gap-4">
          <dt class="text-gray-500 shrink-0">Save</dt>
          <dd class="text-gray-900 text-right">{{ saveSummary }}</dd>
        </div>
      </dl>
      <p class="text-xs text-gray-500 leading-relaxed">
        Prompt preview: {{ formPreview.prompt }}
      </p>
    </section>

    <p v-if="localError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {{ localError }}
    </p>

    <div class="flex flex-wrap gap-3 pt-1">
      <button
        v-if="step !== 'review'"
        type="button"
        class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
        :disabled="!canAdvance || busy"
        @click="goNext"
      >
        Continue
      </button>
      <template v-else>
        <button
          type="button"
          class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          :disabled="busy"
          @click="onGenerate"
        >
          Generate music
        </button>
        <button
          type="button"
          class="px-4 py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          :disabled="busy"
          @click="onEditManual"
        >
          Edit in Manual
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  MUSIC_GUIDE_LENGTH_OPTIONS,
  MUSIC_GUIDE_MOOD_CHIPS,
  MUSIC_GUIDE_PURPOSE_OPTIONS,
  MUSIC_GUIDE_STEPS,
  MUSIC_GUIDE_VOCAL_OPTIONS,
  canAdvanceMusicGuideStep,
  emptyMusicGuideBrief,
  musicGuideBriefToFormState,
  musicGuideStepIndex,
  type MusicGuideBrief,
  type MusicGuideStep
} from '~/lib/music-generation-guide'
import type { CreativeProject } from '~/types/creative-project'

const props = defineProps<{
  projects: CreativeProject[]
  busy?: boolean
  initialProjectId?: string
}>()

const emit = defineEmits<{
  generate: [brief: MusicGuideBrief]
  'edit-manual': [brief: MusicGuideBrief]
  'create-project': []
  'update:projectId': [id: string]
}>()

const brief = reactive<MusicGuideBrief>(emptyMusicGuideBrief())
const step = ref<MusicGuideStep>('purpose')
const localError = ref('')

const purposeOptions = MUSIC_GUIDE_PURPOSE_OPTIONS
const lengthOptions = MUSIC_GUIDE_LENGTH_OPTIONS
const vocalOptions = MUSIC_GUIDE_VOCAL_OPTIONS
const moodChips = MUSIC_GUIDE_MOOD_CHIPS
const steps = MUSIC_GUIDE_STEPS

const stepIndex = computed(() => musicGuideStepIndex(step.value))
const progressPct = computed(() => ((stepIndex.value + 1) / steps.length) * 100)
const canAdvance = computed(() => canAdvanceMusicGuideStep(step.value, brief))
const formPreview = computed(() => musicGuideBriefToFormState(brief))

watch(
  () => props.initialProjectId,
  (id) => {
    if (id && !brief.projectId) brief.projectId = id
  },
  { immediate: true }
)

watch(
  () => brief.projectId,
  (id) => emit('update:projectId', id)
)

const purposeSummary = computed(() => {
  if (brief.purpose === 'other') return brief.purposeOther.trim() || 'Something else'
  return purposeOptions.find(o => o.id === brief.purpose)?.label || '—'
})

const lengthSummary = computed(() =>
  lengthOptions.find(o => o.id === brief.length)?.label || '—'
)

const vocalsSummary = computed(() => {
  if (brief.vocals === 'own_lyrics') return 'Own lyrics'
  if (brief.vocals === 'generate_lyrics') return 'Generate lyrics'
  if (brief.vocals === 'instrumental') return 'Instrumental'
  return '—'
})

const saveSummary = computed(() => {
  if (!brief.saveToProject) return 'Don’t save'
  const name = props.projects.find(p => p.id === brief.projectId)?.name
  return name ? `Save to “${name}”` : 'Save (pick a project)'
})

function goBack () {
  localError.value = ''
  const i = stepIndex.value
  if (i <= 0) return
  step.value = steps[i - 1]
}

function goNext () {
  localError.value = ''
  if (!canAdvance.value) {
    localError.value = 'Complete this step to continue.'
    return
  }
  const i = stepIndex.value
  if (i >= steps.length - 1) return
  step.value = steps[i + 1]
}

function onGenerate () {
  localError.value = ''
  emit('generate', { ...brief })
}

function onEditManual () {
  emit('edit-manual', { ...brief })
}

function applyProjectId (id: string) {
  brief.projectId = id
  brief.saveToProject = true
}

function reset () {
  Object.assign(brief, emptyMusicGuideBrief())
  if (props.initialProjectId) brief.projectId = props.initialProjectId
  step.value = 'purpose'
  localError.value = ''
}

defineExpose({ applyProjectId, reset, brief })
</script>
