<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-gray-600">
        Step {{ stepIndex + 1 }} of {{ steps.length }}
      </p>
      <button
        v-if="step !== 'intent'"
        type="button"
        class="text-sm text-gray-500 hover:text-gray-800"
        :disabled="busy || analyzing"
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

    <!-- Intent -->
    <section v-if="step === 'intent'" class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">What do you want to create today?</h2>
        <p class="mt-1 text-sm text-gray-500">
          Describe it in plain language — we’ll figure out length, vocals, and style for you.
        </p>
      </div>
      <textarea
        id="mg-guide-intent"
        v-model="brief.intent"
        rows="5"
        class="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 text-base focus:outline-none focus:border-primary resize-y leading-relaxed"
        placeholder="e.g. I need a rock song about salamanders"
        :disabled="analyzing || busy"
        @keydown.meta.enter.prevent="goNext"
        @keydown.ctrl.enter.prevent="goNext"
      />
      <p class="text-xs text-gray-400">
        Tip: ⌘/Ctrl + Enter to continue
      </p>
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
        <p class="mt-1 text-sm text-gray-500">
          We interpreted your request. Tweak anything below, or open Manual for full control.
        </p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Your request</p>
        <p class="text-sm text-gray-900 whitespace-pre-wrap">{{ brief.intent }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Length</label>
          <select
            v-model="brief.length"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
          >
            <option v-for="opt in lengthOptions" :key="opt.id" :value="opt.id">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Vocals</label>
          <select
            v-model="brief.vocals"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
          >
            <option v-for="opt in vocalOptions" :key="opt.id" :value="opt.id">
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="brief.vocals === 'own_lyrics'">
        <label for="mg-guide-own-lyrics" class="block text-sm font-medium text-gray-700 mb-1.5">
          Lyrics
        </label>
        <textarea
          id="mg-guide-own-lyrics"
          v-model="brief.ownLyrics"
          rows="4"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
          placeholder="Paste lyrics…"
        />
      </div>

      <div>
        <label for="mg-guide-mood" class="block text-sm font-medium text-gray-700 mb-1.5">
          Mood & style
        </label>
        <textarea
          id="mg-guide-mood"
          v-model="brief.mood"
          rows="2"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
        />
      </div>

      <div>
        <label for="mg-guide-prompt" class="block text-sm font-medium text-gray-700 mb-1.5">
          Composition prompt
        </label>
        <textarea
          id="mg-guide-prompt"
          v-model="brief.compositionPrompt"
          rows="4"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
        />
      </div>

      <p class="text-xs text-gray-500">
        {{ saveSummary }} · {{ purposeSummary }}
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
        :disabled="!canAdvance || busy || analyzing"
        @click="goNext"
      >
        <span v-if="analyzing">Understanding your request…</span>
        <span v-else>Continue</span>
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
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import {
  MUSIC_GUIDE_LENGTH_OPTIONS,
  MUSIC_GUIDE_PURPOSE_OPTIONS,
  MUSIC_GUIDE_STEPS,
  MUSIC_GUIDE_VOCAL_OPTIONS,
  applyMusicGuideAnalyzeResult,
  canAdvanceMusicGuideStep,
  emptyMusicGuideBrief,
  heuristicMusicGuideAnalyze,
  musicGuideStepIndex,
  type MusicGuideAnalyzeResult,
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
const step = ref<MusicGuideStep>('intent')
const localError = ref('')
const analyzing = ref(false)
const analyzedIntent = ref('')

const lengthOptions = MUSIC_GUIDE_LENGTH_OPTIONS
const vocalOptions = MUSIC_GUIDE_VOCAL_OPTIONS
const purposeOptions = MUSIC_GUIDE_PURPOSE_OPTIONS
const steps = MUSIC_GUIDE_STEPS

const stepIndex = computed(() => musicGuideStepIndex(step.value))
const progressPct = computed(() => ((stepIndex.value + 1) / steps.length) * 100)
const canAdvance = computed(() => canAdvanceMusicGuideStep(step.value, brief))

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
  if (brief.purpose === 'other') return brief.purposeOther.trim() || 'Custom'
  return purposeOptions.find(o => o.id === brief.purpose)?.label || 'Custom'
})

const saveSummary = computed(() => {
  if (!brief.saveToProject) return 'Won’t save to a project'
  const name = props.projects.find(p => p.id === brief.projectId)?.name
  return name ? `Save to “${name}”` : 'Save (pick a project)'
})

async function analyzeIntentIfNeeded (): Promise<boolean> {
  const intent = brief.intent.trim()
  if (!intent) return false
  if (analyzedIntent.value === intent && brief.length && brief.vocals) {
    return true
  }

  analyzing.value = true
  localError.value = ''
  try {
    const res = await $fetch<MusicGuideAnalyzeResult & { source?: string }>(
      '/api/music/analyze-intent',
      {
        method: 'POST',
        body: { intent }
      }
    )
    applyMusicGuideAnalyzeResult(brief, res)
    analyzedIntent.value = intent
    return true
  } catch (e: unknown) {
    applyMusicGuideAnalyzeResult(brief, heuristicMusicGuideAnalyze(intent))
    analyzedIntent.value = intent
    localError.value = formatApiFetchError(
      e,
      'Couldn’t reach AI analysis — used a local guess. Review the next screens.'
    )
    return true
  } finally {
    analyzing.value = false
  }
}

function goBack () {
  localError.value = ''
  const i = stepIndex.value
  if (i <= 0) return
  step.value = steps[i - 1]
}

async function goNext () {
  localError.value = ''
  if (!canAdvance.value) {
    localError.value = step.value === 'intent'
      ? 'Tell us what you want to create — a sentence or two is enough.'
      : 'Complete this step to continue.'
    return
  }

  if (step.value === 'intent') {
    const ok = await analyzeIntentIfNeeded()
    if (!ok) return
    step.value = 'save'
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
  step.value = 'intent'
  localError.value = ''
  analyzedIntent.value = ''
}

defineExpose({ applyProjectId, reset, brief })
</script>
