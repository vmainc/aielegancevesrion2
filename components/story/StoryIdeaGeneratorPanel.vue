<template>
  <div class="rounded-xl border-2 border-primary/25 bg-gradient-to-b from-primary/5 to-gray-50 p-5 sm:p-6">
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 mb-1">
          {{ heading }}
        </h2>
        <p class="text-sm text-gray-600 max-w-2xl">
          {{ subheading }}
        </p>
      </div>
      <button
        v-if="showCancel"
        type="button"
        class="shrink-0 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-white transition-colors"
        @click="$emit('cancel')"
      >
        Cancel
      </button>
    </div>

    <p
      v-if="!isAuthenticated"
      class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
    >
      Log in to generate story ideas with AI.
    </p>

    <p v-if="!projectId && isAuthenticated" class="text-sm text-gray-500 mb-4 animate-pulse">
      Preparing workspace…
    </p>

    <p v-if="modelsLoadError" class="text-sm text-red-700 mb-4">
      {{ modelsLoadError }}
    </p>

    <div class="flex flex-wrap gap-4 mb-5">
      <div class="min-w-[10rem]">
        <label class="block text-xs font-medium text-gray-600 mb-1" for="idea-goal">Format</label>
        <select
          id="idea-goal"
          v-model="goalModel"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary disabled:opacity-50"
          :disabled="generating"
        >
          <option value="film">Film / series</option>
          <option value="social">Social / short</option>
          <option value="commercial">Commercial / ad</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="min-w-[8rem]">
        <label class="block text-xs font-medium text-gray-600 mb-1" for="idea-aspect">Aspect</label>
        <select
          id="idea-aspect"
          v-model="aspectModel"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary disabled:opacity-50"
          :disabled="generating"
        >
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
          <option value="1:1">1:1</option>
        </select>
      </div>
    </div>

    <div class="flex justify-between items-center gap-2 mb-2">
      <label class="text-sm font-medium text-gray-700">Your idea</label>
      <PromptEnhanceButton v-model="conceptPrompt" context="concept" />
    </div>
    <textarea
      v-model="conceptPrompt"
      rows="4"
      class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y mb-5"
      :placeholder="promptPlaceholder"
      :disabled="generating || !projectId"
    />

    <fieldset class="mb-5" :disabled="generating || !modelOptions.length || !projectId">
      <legend class="text-sm font-medium text-gray-700 mb-2">AI models</legend>
      <p class="text-xs text-gray-500 mb-3">Select one or more; each model returns a different take on your idea.</p>
      <div class="flex flex-wrap gap-3">
        <label
          v-for="m in modelOptions"
          :key="`idea-${m.id}`"
          class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
        >
          <input
            v-model="selectedModelIds"
            type="checkbox"
            :value="m.id"
            class="rounded border-gray-300 text-primary focus:ring-primary"
          >
          <span class="text-sm text-gray-800">{{ m.label }}</span>
        </label>
      </div>
    </fieldset>

    <button
      type="button"
      class="px-4 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="!canGenerate"
      @click="generateConcepts"
    >
      {{ generating ? 'Generating ideas…' : generateButtonLabel }}
    </button>

    <p v-if="generating" class="mt-4 text-sm text-gray-600 animate-pulse">
      Generating ideas across selected models…
    </p>

    <div v-if="conceptResults != null && conceptResults.length" class="mt-8 space-y-4">
      <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wide">
        Pick an idea
      </h3>
      <div class="grid gap-4">
        <article
          v-for="(r, idx) in conceptResults"
          :key="`idea-result-${r.model}-${idx}`"
          class="rounded-xl border p-4 sm:p-5 bg-white shadow-sm"
          :class="r.error ? 'border-red-200 bg-red-50/50' : 'border-gray-200'"
        >
          <span class="text-xs font-semibold uppercase tracking-wide text-primary">
            {{ modelLabel(r.model) }}
          </span>
          <template v-if="!r.error">
            <h4 class="text-base font-bold text-gray-900 mt-3 mb-2">{{ r.title }}</h4>
            <p class="text-sm text-gray-700 italic mb-3">{{ r.logline }}</p>
            <p
              v-if="'hook' in r && r.hook"
              class="text-sm text-gray-800 mb-3 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2"
            >
              <span class="font-semibold text-gray-900">Hook: </span>{{ r.hook }}
            </p>
            <p class="text-sm text-gray-600 whitespace-pre-wrap mb-4">{{ r.summary }}</p>
            <p
              v-if="'characters' in r && r.characters?.length"
              class="text-xs text-gray-700 mb-3"
            >
              <span class="font-semibold text-gray-900">Cast: </span>{{ r.characters.join(', ') }}
            </p>
            <div class="flex flex-wrap gap-2 mb-4">
              <span v-if="r.tone" class="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-800">{{ r.tone }}</span>
              <span v-if="r.genre" class="text-xs px-2 py-1 rounded-md bg-gray-200 text-gray-800 capitalize">{{ r.genre }}</span>
            </div>
            <button
              type="button"
              class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              :disabled="applyingModel === r.model"
              @click="onApply(r)"
            >
              {{ applyingModel === r.model ? 'Saving…' : applyLabel }}
            </button>
          </template>
          <p v-else class="text-sm text-red-800 mt-3">{{ r.error }}</p>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConceptGeneratorResultItem, GeneratedConceptItem } from '~/types/concept-generator'
import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'

const props = withDefaults(
  defineProps<{
    projectId: string
    goal?: ProjectGoal
    aspectRatio?: ProjectAspectRatio
    heading?: string
    subheading?: string
    applyLabel?: string
    generateButtonLabel?: string
    showCancel?: boolean
  }>(),
  {
    goal: 'film',
    aspectRatio: '16:9',
    heading: 'Generate story ideas',
    subheading: 'Describe your idea, compare AI models, then save the one you want to develop.',
    applyLabel: 'Use this story',
    generateButtonLabel: 'Generate story ideas',
    showCancel: false
  }
)

export type StoryIdeaApplyPayload = {
  item: GeneratedConceptItem
  goal: ProjectGoal
  aspectRatio: ProjectAspectRatio
}

const emit = defineEmits<{
  apply: [payload: StoryIdeaApplyPayload]
  cancel: []
}>()

const { isAuthenticated, getAuthToken } = useAuth()
const toast = useToast()

const goalModel = ref<ProjectGoal>(props.goal)
const aspectModel = ref<ProjectAspectRatio>(props.aspectRatio)
const conceptPrompt = ref('')
const modelOptions = ref<Array<{ id: string; label: string }>>([])
const modelsLoadError = ref('')
const selectedModelIds = ref<string[]>([])
const generating = ref(false)
const conceptResults = ref<ConceptGeneratorResultItem[] | null>(null)
const applyingModel = ref<string | null>(null)

watch(
  () => props.goal,
  (g) => { if (g) goalModel.value = g }
)
watch(
  () => props.aspectRatio,
  (a) => { if (a) aspectModel.value = a }
)

const promptPlaceholder = computed(() => {
  if (goalModel.value === 'social') {
    return 'e.g. Anthropomorphic egg sandwich wakes up in a diner, realizes it is today’s special — 30s vertical comedy…'
  }
  if (goalModel.value === 'commercial') {
    return 'e.g. Launch spot for a cold-brew brand — morning ritual, product hero, upbeat 15s vertical…'
  }
  return 'Describe your film or video idea — genre, mood, characters, and what happens…'
})

const canGenerate = computed(() => {
  if (generating.value || !isAuthenticated.value || !props.projectId) return false
  if (!conceptPrompt.value.trim()) return false
  if (!selectedModelIds.value.length) return false
  return true
})

function modelLabel (modelId: string) {
  return modelOptions.value.find(m => m.id === modelId)?.label ?? modelId
}

function isSuccessResult (r: ConceptGeneratorResultItem): r is GeneratedConceptItem {
  if ('error' in r && typeof (r as { error?: unknown }).error === 'string') return false
  return typeof (r as GeneratedConceptItem).title === 'string'
}

async function loadModelOptions () {
  modelsLoadError.value = ''
  try {
    const res = await $fetch<{ models: Array<{ id: string; label: string }> }>('/api/concept-generator-models')
    modelOptions.value = res.models ?? []
    if (!selectedModelIds.value.length && modelOptions.value.length) {
      selectedModelIds.value = [modelOptions.value[0]!.id]
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'data' in e
      ? String((e as { data?: { message?: string } }).data?.message)
      : 'Could not load models.'
    modelsLoadError.value = msg || 'Could not load models.'
  }
}

async function generateConcepts () {
  if (!canGenerate.value) return
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Log in to generate ideas.', 'error')
    return
  }
  generating.value = true
  conceptResults.value = null
  try {
    const res = await $fetch<ConceptGeneratorResultItem[]>('/api/generate-concepts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        project_id: props.projectId,
        user_prompt: conceptPrompt.value.trim(),
        selected_models: [...selectedModelIds.value],
        goal: goalModel.value,
        aspect_ratio: aspectModel.value
      }
    })
    conceptResults.value = Array.isArray(res) ? res : []
    const ok = conceptResults.value.filter(r => !('error' in r && r.error)).length
    const fail = conceptResults.value.length - ok
    if (ok && !fail) {
      toast.showToast(`Received ${ok} idea(s).`, 'success')
    } else if (ok && fail) {
      toast.showToast(`${ok} succeeded, ${fail} failed — see cards.`, 'info')
    } else {
      toast.showToast('All model requests failed — see cards.', 'error')
    }
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? (e as { data?: { message?: string; statusMessage?: string } }).data?.message ||
          (e as { data?: { statusMessage?: string } }).data?.statusMessage
        : e instanceof Error
          ? e.message
          : 'Generation failed.'
    toast.showToast(msg || 'Generation failed.', 'error')
  } finally {
    generating.value = false
  }
}

function onApply (r: ConceptGeneratorResultItem) {
  if (!isSuccessResult(r)) return
  applyingModel.value = r.model
  emit('apply', {
    item: r,
    goal: goalModel.value,
    aspectRatio: aspectModel.value
  })
}

function clearApplying () {
  applyingModel.value = null
}

function clearResults () {
  conceptResults.value = null
}

defineExpose({ clearApplying, clearResults })

onMounted(() => {
  void loadModelOptions()
})
</script>
