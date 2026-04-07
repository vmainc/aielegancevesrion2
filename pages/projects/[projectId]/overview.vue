<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
      · Your synopsis lives here; director bible and continuity are on the Director tab.
    </p>

    <p
      v-if="isLocalProject"
      class="mb-8 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3"
    >
      This project is saved on this device only. Sign in and create a project from
      <NuxtLink to="/projects" class="font-medium text-primary hover:underline">Projects</NuxtLink>
      to sync with your account.
    </p>

    <section
      v-if="hasConcept"
      class="rounded-xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8 mb-10"
    >
      <p class="text-xs font-semibold uppercase tracking-wide text-primary mb-3">Synopsis</p>
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-6">
        {{ project?.name }}
      </h1>
      <div
        v-if="project?.genre || project?.tone || (project?.themes && project.themes.length)"
        class="flex flex-wrap gap-2 mb-6"
      >
        <span v-if="project?.genre" class="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 capitalize">{{ project.genre }}</span>
        <span v-if="project?.tone" class="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{{ project.tone }}</span>
        <span
          v-for="t in (project?.themes ?? [])"
          :key="t"
          class="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600"
        >{{ t }}</span>
      </div>
      <div
        class="text-gray-800 text-base sm:text-lg leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-6"
      >
        {{ project?.synopsis || project?.conceptNotes }}
      </div>

      <template v-if="showImportedScriptOverview">
        <div class="border-t border-gray-100 pt-6 mt-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-2">Three-act thematic breakdown</h2>
          <p class="text-sm text-gray-600 mb-3">
            Same structure as Script Wizard: how the theme moves across acts after import.
          </p>
          <pre
            v-if="threeActBreakdown"
            class="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed rounded-lg border border-gray-200 bg-gray-50 p-4"
          >{{ threeActBreakdown }}</pre>
          <p v-else class="text-sm text-gray-500">
            No act breakdown stored yet. Re-import the script from Overview (screenplay upload) to regenerate analysis.
          </p>
        </div>

        <div class="border-t border-gray-100 pt-6 mt-6">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 class="text-lg font-semibold text-gray-900">Comparable films</h2>
            <button
              v-if="canLoadImportedMovies"
              type="button"
              class="px-3 py-1.5 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:opacity-50"
              :disabled="loadingOverviewMovies"
              @click="loadOverviewMovies"
            >
              {{ loadingOverviewMovies ? 'Refreshing…' : 'Refresh' }}
            </button>
          </div>
          <p class="text-sm text-gray-600 mb-4">
            Posters and ratings from OMDb, using titles extracted from your treatment — mirrors Script Wizard.
          </p>
          <p
            v-if="!canLoadImportedMovies"
            class="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
          >
            Sign in with a cloud-saved project to load film metadata.
          </p>
          <div v-else-if="loadingOverviewMovies" class="py-4">
            <FilmReelLoader
              size="sm"
              label="Cueing comparable films"
              sub-label="Looking up titles from your analysis…"
            />
          </div>
          <p v-else-if="overviewMoviesError" class="text-sm text-red-700">{{ overviewMoviesError }}</p>
          <ul v-else-if="overviewMovies.length" class="grid sm:grid-cols-2 gap-4">
            <li
              v-for="m in overviewMovies"
              :key="m.imdbId || `${m.title}-${m.year}`"
              class="rounded-xl border border-gray-200 bg-gray-50 p-4"
            >
              <div class="flex gap-3">
                <img
                  v-if="m.poster && m.poster !== 'N/A'"
                  :src="m.poster"
                  alt=""
                  class="w-16 h-24 object-cover rounded border border-gray-200 shrink-0"
                >
                <div class="min-w-0">
                  <p class="font-semibold text-gray-900 truncate">{{ m.title }}</p>
                  <p class="text-xs text-gray-500 mb-1">{{ m.year || '—' }} · {{ m.genre || '—' }}</p>
                  <p class="text-xs text-gray-600 line-clamp-2 mb-1">{{ m.plot || 'No plot from OMDb.' }}</p>
                  <p class="text-xs text-gray-500">IMDb: {{ m.imdbRating || '—' }} · RT: {{ m.rottenTomatoes || '—' }}</p>
                </div>
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-gray-500">No comparable films resolved yet. Set OMDb in env, or tap Refresh after import.</p>
          <p v-if="overviewCandidates.length && !overviewMovies.length && !loadingOverviewMovies" class="text-xs text-gray-500 mt-3">
            Extracted titles: {{ overviewCandidates.map(c => c.title).join(', ') }}
          </p>
        </div>

        <p class="text-sm text-gray-500 mt-6 pt-6 border-t border-gray-100">
          <template v-if="showImportedScriptOverview">
            Synopsis and treatment came from your screenplay import — the Story step is skipped in the sidebar. Continue with
            <NuxtLink :to="`/projects/${projectId}/characters`" class="text-primary font-medium hover:underline">Characters</NuxtLink>.
          </template>
          <template v-else>
            Full treatment text and AI regeneration:
            <NuxtLink :to="`/projects/${projectId}/story`" class="text-primary font-medium hover:underline">Story</NuxtLink>
          </template>
        </p>
      </template>
    </section>

    <ProjectOverviewScriptImportPanel
      v-if="canCloudImport && hasConcept && !showGeneratorForm"
      v-model:aspect="overviewAspect"
      v-model:goal="overviewGoal"
      :show-aspect-goal="false"
      :importing="overviewImporting"
      :analyzing="overviewAnalyzing"
      :analyze-enabled="Boolean(scriptWorkflowAssetId)"
      :error="overviewImportError"
      :has-file="Boolean(overviewImportFile)"
      heading="Screenplay"
      @file-change="onOverviewImportFile"
      @import-click="importScriptFromOverview"
      @analyze-click="runScriptAnalyzeFromOverview"
    />

    <!-- Saved concept: actions (generator hidden until they choose "different AI") -->
    <div
      v-if="hasConcept && !showGeneratorForm"
      class="rounded-xl border border-primary/30 bg-primary/5 p-5 sm:p-6 mb-8"
    >
      <h2 class="text-lg font-semibold text-gray-900 mb-1">Concept saved</h2>
      <p class="text-sm text-gray-600 mb-4">
        Try other models or remove this concept to start fresh.
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors"
          @click="openGeneratorAgain"
        >
          Generate with different AI
        </button>
        <button
          type="button"
          class="px-4 py-2 border border-red-200 text-red-800 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
          :disabled="deletingConcept"
          @click="deleteConcept"
        >
          {{ deletingConcept ? 'Removing…' : 'Delete concept' }}
        </button>
      </div>
    </div>

    <!-- Concept generator (first time, or after "Generate with different AI") -->
    <section
      v-if="showGeneratorForm || !hasConcept"
      class="rounded-xl border border-gray-200 bg-gray-50 p-6 sm:p-8 mb-8"
    >
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-1">
            {{ hasConcept ? 'Compare new AI concepts' : 'Start by generating your concept' }}
          </h2>
          <p class="text-sm text-gray-500">
            {{
              hasConcept
                ? 'Your saved concept stays below until you pick a new one.'
                : 'Describe your idea, pick one or more models, compare results — or import a screenplay below.'
            }}
          </p>
        </div>
        <button
          v-if="hasConcept"
          type="button"
          class="shrink-0 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          @click="cancelGeneratorPanel"
        >
          Cancel
        </button>
      </div>

      <ClientOnly>
        <p
          v-if="!isAuthenticated"
          class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
        >
          Log in to generate concepts with AI.
        </p>
      </ClientOnly>

      <ProjectOverviewScriptImportPanel
        v-if="canCloudImport"
        v-model:aspect="overviewAspect"
        v-model:goal="overviewGoal"
        :show-aspect-goal="false"
        :importing="overviewImporting"
        :analyzing="overviewAnalyzing"
        :analyze-enabled="Boolean(scriptWorkflowAssetId)"
        :error="overviewImportError"
        :has-file="Boolean(overviewImportFile)"
        heading="Or import a screenplay"
        @file-change="onOverviewImportFile"
        @import-click="importScriptFromOverview"
        @analyze-click="runScriptAnalyzeFromOverview"
      />
      <ClientOnly>
        <p
          v-if="isAuthenticated && !canCloudImport"
          class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
        >
          Sign in and use a project from
          <NuxtLink to="/projects" class="font-medium text-primary hover:underline">Projects</NuxtLink>
          to import a screenplay into this workspace.
        </p>
      </ClientOnly>

      <div v-if="modelsLoadError" class="text-sm text-red-700 mb-4">
        {{ modelsLoadError }}
      </div>

      <p
        v-if="canCloudImport"
        class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3"
      >
        Generate from a prompt
      </p>
      <div class="flex justify-between items-center gap-2 mb-2">
        <label class="text-sm font-medium text-gray-700">Your idea</label>
        <PromptEnhanceButton v-model="conceptPrompt" context="concept" />
      </div>
      <textarea
        ref="promptTextareaRef"
        v-model="conceptPrompt"
        rows="4"
        class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y mb-5"
        placeholder="Describe your idea..."
        :disabled="generating"
      />

      <fieldset class="mb-5" :disabled="generating || !(modelOptions?.length)">
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

      <div v-if="conceptResults != null && conceptResults.length" class="mt-8 space-y-4">
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

    <h2 class="text-lg font-semibold text-gray-900 mb-3">Quick actions</h2>
    <div class="flex flex-wrap gap-3">
      <NuxtLink
        :to="`/projects/${projectId}/scenes`"
        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
      >
        Add Scene
      </NuxtLink>
      <NuxtLink
        :to="`/projects/${projectId}/director`"
        class="px-4 py-2 border border-gray-200 text-gray-800 hover:border-primary/50 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
      >
        Director →
      </NuxtLink>
      <NuxtLink
        v-if="!showImportedScriptOverview"
        :to="`/projects/${projectId}/story`"
        class="px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
      >
        Story →
      </NuxtLink>
      <NuxtLink
        v-else
        :to="`/projects/${projectId}/characters`"
        class="px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
      >
        Characters →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { projectStorySatisfiedByScriptImport } from '~/lib/project-workflow'
import { extractThreeActBreakdownFromTreatment } from '~/lib/extract-three-act-from-treatment'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { formatStoredConceptNotes } from '~/lib/format-stored-concept'
import { SCRIPT_WIZARD_UPLOAD_CLIENT_MS } from '~/lib/script-wizard-timeouts'
import type { ConceptGeneratorResultItem, GeneratedConceptItem } from '~/types/concept-generator'
import type { CreativeProject } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

type OverviewComparableCandidate = { title: string; year?: string }
type OverviewOmdbMovie = {
  title: string
  year?: string
  imdbId?: string
  genre?: string
  plot?: string
  poster?: string
  imdbRating?: string
  rottenTomatoes?: string
}

const { activeProject, activeProjectId, updateProject, registerImportedProject } = useCreativeProject()
const { isAuthenticated, getAuthToken } = useAuth()
const { stepBadge } = useProjectWorkflowStep()
const toast = useToast()

const PB_ID = /^[a-z0-9]{15}$/

const projectId = activeProjectId
const project = activeProject

const overviewCandidates = ref<OverviewComparableCandidate[]>([])
const overviewMovies = ref<OverviewOmdbMovie[]>([])
const loadingOverviewMovies = ref(false)
const overviewMoviesError = ref('')

const showImportedScriptOverview = computed(() => projectStorySatisfiedByScriptImport(project.value))

const threeActBreakdown = computed(() =>
  extractThreeActBreakdownFromTreatment(project.value?.treatment || '')
)

const canLoadImportedMovies = computed(
  () =>
    isAuthenticated.value &&
    PB_ID.test(projectId.value) &&
    showImportedScriptOverview.value
)

const isLocalProject = computed(() => !PB_ID.test(projectId.value))

const canCloudImport = computed(() => isAuthenticated.value && PB_ID.test(projectId.value))

const overviewImportFile = ref<File | null>(null)
const overviewImporting = ref(false)
const overviewAnalyzing = ref(false)
const overviewImportError = ref('')
const scriptWorkflowAssetId = ref('')
const overviewAspect = ref<'16:9' | '9:16' | '1:1'>('16:9')
const overviewGoal = ref<'film' | 'social' | 'commercial' | 'other'>('film')

async function syncScriptWorkflowAssetFromServer () {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token || !PB_ID.test(id)) {
    scriptWorkflowAssetId.value = ''
    return
  }
  try {
    const res = await $fetch<{ items: ProjectAsset[] }>(`/api/projects/${id}/assets`, {
      params: { kind: 'script' },
      headers: { Authorization: `Bearer ${token}` }
    })
    let best = ''
    let bestCreated = ''
    for (const a of res.items || []) {
      const src =
        a.metadata && typeof a.metadata === 'object' && a.metadata !== null && 'source' in a.metadata
          ? String((a.metadata as { source?: string }).source)
          : ''
      if (src !== 'script_import') continue
      const c = a.created || ''
      if (!bestCreated || c >= bestCreated) {
        bestCreated = c
        best = a.id
      }
    }
    scriptWorkflowAssetId.value = best
  } catch {
    /* ignore */
  }
}

watch(
  () => projectId.value,
  () => {
    void syncScriptWorkflowAssetFromServer()
  },
  { immediate: true }
)

function onOverviewImportFile (e: Event) {
  const input = e.target as HTMLInputElement
  overviewImportFile.value = input.files?.[0] || null
}

async function importScriptFromOverview () {
  const id = projectId.value
  const token = getAuthToken()
  const file = overviewImportFile.value
  if (!id || !token || !file) return
  overviewImporting.value = true
  overviewImportError.value = ''
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await $fetch<{
      project: CreativeProject
      scriptAsset: { ok: boolean; message?: string; id?: string }
      upload?: { previewSceneCount: number; parseWarning?: string }
    }>(`/api/projects/${id}/import-script`, {
      method: 'POST',
      body: form,
      headers: { Authorization: `Bearer ${token}` },
      timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
    })
    registerImportedProject(res.project)
    overviewImportFile.value = null
    if (res.scriptAsset?.ok && res.scriptAsset.id) {
      scriptWorkflowAssetId.value = res.scriptAsset.id
    } else {
      await syncScriptWorkflowAssetFromServer()
    }
    toast.showToast(
      'Screenplay saved. It appears under Assets → Scripts (sidebar). Run “Run treatment & scene import” on Overview when you want AI synopsis, scenes, and characters.',
      'success'
    )
    if (res.upload?.parseWarning) {
      toast.showToast(`Parse preview: ${res.upload.parseWarning}`, 'info')
    }
    if (res.scriptAsset && !res.scriptAsset.ok) {
      toast.showToast(
        `Could not save file to Assets: ${res.scriptAsset.message || 'unknown error'}`,
        'error'
      )
    }
  } catch (e: unknown) {
    overviewImportError.value = formatApiFetchError(e, 'Save failed')
    toast.showToast(overviewImportError.value, 'error')
  } finally {
    overviewImporting.value = false
  }
}

async function runScriptAnalyzeFromOverview () {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token) return
  overviewAnalyzing.value = true
  overviewImportError.value = ''
  try {
    const body = scriptWorkflowAssetId.value ? { assetId: scriptWorkflowAssetId.value } : {}
    const res = await $fetch<{
      project: CreativeProject
      scriptAsset: { ok: boolean; message?: string; id?: string }
    }>(`/api/projects/${id}/script/analyze`, {
      method: 'POST',
      body,
      headers: { Authorization: `Bearer ${token}` },
      timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
    })
    registerImportedProject(res.project)
    if (res.scriptAsset?.ok && res.scriptAsset.id) {
      scriptWorkflowAssetId.value = res.scriptAsset.id
    }
    toast.showToast('AI import finished — opening Characters.', 'success')
    if (res.scriptAsset && !res.scriptAsset.ok) {
      toast.showToast(res.scriptAsset.message || 'Project updated; asset notes may be incomplete.', 'info')
    }
    await navigateTo(`/projects/${id}/characters`)
  } catch (e: unknown) {
    overviewImportError.value = formatApiFetchError(e, 'AI import failed')
    toast.showToast(overviewImportError.value, 'error')
  } finally {
    overviewAnalyzing.value = false
  }
}

const modelOptions = ref<Array<{ id: string; label: string }>>([])
const modelsLoadError = ref('')
const conceptPrompt = ref('')
const selectedModelIds = ref<string[]>([])
const generating = ref(false)
const conceptResults = ref<ConceptGeneratorResultItem[] | null>(null)
const applyingModel = ref<string | null>(null)
const showGeneratorForm = ref(true)
const deletingConcept = ref(false)
const promptTextareaRef = ref<HTMLTextAreaElement | null>(null)

const hasConcept = computed(() => {
  const p = project.value
  if (!p) return false
  return Boolean((p.synopsis || '').trim() || (p.conceptNotes || '').trim())
})

watch(hasConcept, (has) => {
  showGeneratorForm.value = !has
}, { immediate: true })

async function loadOverviewMovies () {
  const id = projectId.value
  const token = getAuthToken()
  overviewMoviesError.value = ''
  if (!id || !token || !PB_ID.test(id) || !showImportedScriptOverview.value) {
    overviewCandidates.value = []
    overviewMovies.value = []
    return
  }
  loadingOverviewMovies.value = true
  try {
    const res = await $fetch<{ candidates: OverviewComparableCandidate[]; movies: OverviewOmdbMovie[] }>(
      `/api/projects/${id}/script-wizard/movies`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    overviewCandidates.value = res.candidates || []
    overviewMovies.value = res.movies || []
  } catch (e: unknown) {
    overviewMoviesError.value = formatApiFetchError(e, 'Could not load comparable films')
  } finally {
    loadingOverviewMovies.value = false
  }
}

watch(
  () => [projectId.value, project.value?.treatment, canLoadImportedMovies.value] as const,
  () => {
    if (canLoadImportedMovies.value) {
      void loadOverviewMovies()
    } else {
      overviewCandidates.value = []
      overviewMovies.value = []
      overviewMoviesError.value = ''
    }
  },
  { immediate: true }
)

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

function openGeneratorAgain () {
  showGeneratorForm.value = true
  nextTick(() => promptTextareaRef.value?.focus())
}

function cancelGeneratorPanel () {
  showGeneratorForm.value = false
}

async function deleteConcept () {
  if (!confirm('Remove this concept? Synopsis and concept notes will be cleared.')) return
  const id = projectId.value
  if (!id) return
  deletingConcept.value = true
  try {
    await updateProject(id, { synopsis: '', conceptNotes: '', genre: '', tone: '' })
    conceptResults.value = null
    showGeneratorForm.value = true
    toast.showToast('Concept removed.', 'success')
  } catch {
    toast.showToast('Could not remove concept.', 'error')
  } finally {
    deletingConcept.value = false
  }
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
    const conceptNotes = formatStoredConceptNotes({
      title: item.title,
      logline: item.logline,
      modelId: item.model,
      modelLabel: label
    })
    await updateProject(id, {
      name: item.title.slice(0, 500),
      synopsis: item.summary,
      genre: item.genre || undefined,
      tone: item.tone || undefined,
      conceptNotes
    })
    conceptResults.value = null
    showGeneratorForm.value = false
    toast.showToast('Concept applied to project.', 'success')
  } catch {
    toast.showToast('Could not save concept.', 'error')
  } finally {
    applyingModel.value = null
  }
}

</script>
