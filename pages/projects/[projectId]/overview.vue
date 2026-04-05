<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">Step 1 of 5</span>
      · Shape the idea; director bible and continuity live on the Director tab.
    </p>

    <!-- Concept generator -->
    <section class="rounded-xl border border-gray-200 bg-gray-50 p-6 sm:p-8 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-1">Start by generating your concept</h2>
      <p class="text-sm text-gray-500 mb-5">
        Describe your idea, pick one or more models, and compare results. You can regenerate anytime.
      </p>

      <ClientOnly>
        <p
          v-if="!isAuthenticated"
          class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
        >
          Log in to generate concepts with AI.
        </p>
      </ClientOnly>

      <div v-if="modelsLoadError" class="text-sm text-red-700 mb-4">
        {{ modelsLoadError }}
      </div>

      <label class="block text-sm font-medium text-gray-700 mb-2">Your idea</label>
      <textarea
        v-model="conceptPrompt"
        rows="4"
        class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y mb-5"
        placeholder="Describe your idea..."
        :disabled="generating"
      />

      <fieldset class="mb-5" :disabled="generating || !modelOptions.length">
        <legend class="text-sm font-medium text-gray-700 mb-2">Models</legend>
        <p class="text-xs text-gray-500 mb-3">Select one or more; requests run in parallel.</p>
        <div class="flex flex-wrap gap-3">
          <label
            v-for="m in modelOptions"
            :key="m.id"
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
        {{ generating ? 'Generating concepts...' : 'Generate Concepts' }}
      </button>

      <p v-if="generating" class="mt-4 text-sm text-gray-600 animate-pulse">
        Generating concepts...
      </p>

      <div v-if="conceptResults !== null && conceptResults.length" class="mt-8 space-y-4">
        <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wide">Results</h3>
        <div class="grid gap-4 sm:grid-cols-1">
          <article
            v-for="(r, idx) in conceptResults"
            :key="`${r.model}-${idx}`"
            class="rounded-xl border p-4 sm:p-5 bg-white shadow-sm"
            :class="r.error ? 'border-red-200 bg-red-50/50' : 'border-gray-200'"
          >
            <div class="flex flex-wrap items-start justify-between gap-2 mb-3">
              <span class="text-xs font-semibold uppercase tracking-wide text-primary">
                {{ modelLabel(r.model) }}
              </span>
            </div>
            <template v-if="!r.error">
              <h4 class="text-base font-bold text-gray-900 mb-2">{{ r.title }}</h4>
              <p class="text-sm text-gray-700 italic mb-3">{{ r.logline }}</p>
              <p class="text-sm text-gray-600 whitespace-pre-wrap mb-4">{{ r.summary }}</p>
              <div class="flex flex-wrap gap-2 mb-4">
                <span v-if="r.tone" class="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-800">{{ r.tone }}</span>
                <span v-if="r.genre" class="text-xs px-2 py-1 rounded-md bg-gray-200 text-gray-800 capitalize">{{ r.genre }}</span>
              </div>
              <button
                type="button"
                class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
                :disabled="applyingModel === r.model"
                @click="useThisConcept(r)"
              >
                {{ applyingModel === r.model ? 'Saving…' : 'Use this concept' }}
              </button>
            </template>
            <template v-else>
              <p class="text-sm text-red-800">{{ r.error }}</p>
            </template>
          </article>
        </div>
      </div>
    </section>

    <div v-if="hasConcept" class="rounded-xl border border-gray-200 bg-gray-50 p-6 mb-8 space-y-4">
      <div v-if="project?.genre || project?.tone || (project?.themes && project.themes.length)" class="flex flex-wrap gap-2">
        <span v-if="project.genre" class="text-xs px-2 py-1 rounded bg-gray-200 text-gray-800 capitalize">{{ project.genre }}</span>
        <span v-if="project.tone" class="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">{{ project.tone }}</span>
        <span
          v-for="t in project.themes"
          :key="t"
          class="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600"
        >{{ t }}</span>
      </div>
      <div>
        <h2 class="text-sm font-medium text-gray-600 uppercase tracking-wide mb-2">Current concept</h2>
        <p class="text-lg font-semibold text-gray-900 mb-2">{{ project?.name }}</p>
        <p class="text-gray-800 whitespace-pre-wrap">{{ project?.synopsis || project?.conceptNotes }}</p>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">Director & continuity</h2>
        <p class="text-sm text-gray-500 mt-0.5">
          Presets, camera bible, and continuity memory are on their own tab.
        </p>
      </div>
      <NuxtLink
        :to="`/projects/${projectId}/director`"
        class="shrink-0 px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center"
      >
        Open Director →
      </NuxtLink>
    </div>

    <h2 class="text-lg font-semibold text-gray-900 mb-4">Project notes</h2>
    <div class="space-y-4 mb-8">
      <div>
        <label class="block text-sm text-gray-600 mb-1">Synopsis</label>
        <textarea
          v-model="synopsisLocal"
          rows="4"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
          placeholder="One or two paragraphs…"
          @blur="saveSynopsis"
        />
      </div>
      <div>
        <label class="block text-sm text-gray-600 mb-1">Concept notes</label>
        <textarea
          v-model="conceptLocal"
          rows="3"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
          placeholder="Tone, references, constraints…"
          @blur="saveConcept"
        />
      </div>
    </div>

    <h2 class="text-lg font-semibold text-gray-900 mb-3">Quick actions</h2>
    <div class="flex flex-wrap gap-3">
      <button
        type="button"
        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors"
        @click="runPlaceholder('Add Scene')"
      >
        Add Scene
      </button>
      <NuxtLink
        :to="`/projects/${projectId}/director`"
        class="px-4 py-2 border border-gray-200 text-gray-800 hover:border-primary/50 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
      >
        Director →
      </NuxtLink>
      <NuxtLink
        :to="`/projects/${projectId}/story`"
        class="px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
      >
        Story →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatStoredConceptNotes } from '~/lib/format-stored-concept'
import type { ConceptGeneratorResultItem, GeneratedConceptItem } from '~/types/concept-generator'

const { activeProject, activeProjectId, updateProject } = useCreativeProject()
const { isAuthenticated, getAuthToken } = useAuth()
const toast = useToast()

const projectId = activeProjectId
const project = activeProject

const synopsisLocal = ref('')
const conceptLocal = ref('')

const modelOptions = ref<Array<{ id: string; label: string }>>([])
const modelsLoadError = ref('')
const conceptPrompt = ref('')
const selectedModelIds = ref<string[]>([])
const generating = ref(false)
const conceptResults = ref<ConceptGeneratorResultItem[] | null>(null)
const applyingModel = ref<string | null>(null)

watch(project, (p) => {
  if (!p) return
  synopsisLocal.value = p.synopsis
  conceptLocal.value = p.conceptNotes
}, { immediate: true })

const hasConcept = computed(() => {
  const p = project.value
  if (!p) return false
  return Boolean((p.synopsis || '').trim() || (p.conceptNotes || '').trim())
})

const canGenerate = computed(() => {
  if (generating.value) return false
  if (!isAuthenticated.value) return false
  if (!conceptPrompt.value.trim()) return false
  if (!selectedModelIds.value.length) return false
  return true
})

function modelLabel (modelId: string) {
  return modelOptions.value.find(m => m.id === modelId)?.label ?? modelId
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

onMounted(() => {
  void loadModelOptions()
})

async function generateConcepts () {
  const id = projectId.value
  if (!id || !canGenerate.value) return
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Log in to generate concepts.', 'error')
    return
  }
  generating.value = true
  conceptResults.value = null
  try {
    const res = await $fetch<ConceptGeneratorResultItem[]>('/api/generate-concepts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        project_id: id,
        user_prompt: conceptPrompt.value.trim(),
        selected_models: [...selectedModelIds.value]
      }
    })
    conceptResults.value = Array.isArray(res) ? res : []
    const ok = conceptResults.value.filter(r => !('error' in r && r.error)).length
    const fail = conceptResults.value.length - ok
    if (ok && !fail) {
      toast.showToast(`Received ${ok} concept(s).`, 'success')
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

function isSuccessResult (r: ConceptGeneratorResultItem): r is GeneratedConceptItem {
  if ('error' in r && typeof (r as { error?: unknown }).error === 'string') {
    return false
  }
  return typeof (r as GeneratedConceptItem).title === 'string'
}

async function useThisConcept (item: ConceptGeneratorResultItem) {
  if (!isSuccessResult(item)) return
  const id = projectId.value
  if (!id) return
  applyingModel.value = item.model
  try {
    const label = modelLabel(item.model)
    const header = formatStoredConceptNotes({
      title: item.title,
      logline: item.logline,
      modelId: item.model,
      modelLabel: label
    })
    const rest = (conceptLocal.value || '').trim()
    const conceptNotes = rest ? `${header}\n${rest}` : header
    await updateProject(id, {
      name: item.title.slice(0, 500),
      synopsis: item.summary,
      genre: item.genre || undefined,
      tone: item.tone || undefined,
      conceptNotes
    })
    conceptLocal.value = conceptNotes
    synopsisLocal.value = item.summary
    toast.showToast('Concept applied to project.', 'success')
  } catch {
    toast.showToast('Could not save concept.', 'error')
  } finally {
    applyingModel.value = null
  }
}

async function saveSynopsis () {
  const id = projectId.value
  if (!id) return
  await updateProject(id, { synopsis: synopsisLocal.value })
}

async function saveConcept () {
  const id = projectId.value
  if (!id) return
  await updateProject(id, { conceptNotes: conceptLocal.value })
}

function runPlaceholder (label: string) {
  toast.showToast(`${label} is not wired yet — coming soon.`, 'info')
}
</script>
