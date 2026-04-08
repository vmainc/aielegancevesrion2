<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Script Wizard</h1>
      <p class="text-sm text-gray-600 max-w-3xl">
        Same first step as importing a screenplay into a project: upload for AI analysis, then optionally generate the full treatment or run the Script Wizard breakdown (three-act lens). Attach scripts to projects from Assets when you are ready.
      </p>
    </div>

    <ClientOnly>
      <div v-if="!isAuthenticated" class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        Sign in to use Script Wizard.
      </div>

      <template v-else>
      <div class="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6 mb-8 relative overflow-hidden">
        <h2 class="text-lg font-semibold text-gray-900 mb-2">Upload script</h2>
        <p class="text-sm text-gray-600 mb-4">
          Upload Final Draft, PDF, or TXT. This step runs the <span class="font-medium text-gray-800">analysis</span> (synopsis, genre, comps list). Then use the buttons on the right to add the prose treatment and/or the three-act breakdown — large files can take many minutes per step.
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".fdx,.pdf,.txt,text/plain,application/pdf,application/xml,text/xml"
            class="text-sm"
            :disabled="uploading"
            @change="onFileChange"
          >
          <button
            type="button"
            class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            :disabled="uploading || !selectedFile"
            @click="uploadScript"
          >
            {{ uploading ? 'Working…' : 'Add to Script Wizard' }}
          </button>
        </div>
        <div
          v-if="uploading"
          class="mt-6 rounded-xl border border-primary/25 bg-white/90 p-6 sm:p-8"
        >
          <FilmReelLoader
            size="lg"
            label="Rolling — processing your script"
            :sub-label="uploadStatusHint"
          />
        </div>
        <p v-if="uploadError" class="mt-3 text-sm text-red-700">{{ uploadError }}</p>
      </div>

      <div class="grid lg:grid-cols-[22rem_1fr] gap-6">
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-700">My scripts</h2>
            <button
              type="button"
              class="text-xs px-2.5 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
              :disabled="loadingScripts"
              @click="loadScripts"
            >
              {{ loadingScripts ? 'Loading…' : 'Refresh' }}
            </button>
          </div>
          <p v-if="scriptsError" class="p-4 text-sm text-red-700">{{ scriptsError }}</p>
          <div v-else-if="loadingScripts" class="p-6">
            <FilmReelLoader
              size="sm"
              label="Loading your scripts"
              sub-label="Fetching your library…"
            />
          </div>
          <ul v-else-if="scripts.length" class="divide-y divide-gray-200">
            <li v-for="s in scripts" :key="s.id">
              <button
                type="button"
                class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                :class="selectedScriptId === s.id ? 'bg-primary/5' : ''"
                @click="selectScript(s.id)"
              >
                <p class="font-medium text-gray-900 truncate">{{ s.title }}</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ s.status.replace('_', ' ') }} · {{ formatDate(s.updated) }}
                </p>
              </button>
            </li>
          </ul>
          <p v-else class="p-4 text-sm text-gray-500">
            No scripts yet. Upload your first script above.
            <span class="block mt-2 text-xs text-gray-400">Screenplay analysis defaults to English when you add a script.</span>
          </p>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <template v-if="!selectedScript">
            <p class="text-sm text-gray-500">
              {{
                loadingScripts
                  ? 'Loading your library…'
                  : 'Select a script to view analysis and similar movies.'
              }}
            </p>
          </template>
          <template v-else>
            <h2 class="text-xl font-semibold text-gray-900 mb-1">{{ selectedScript.title }}</h2>
            <p class="text-xs text-gray-500 mb-4">
              {{ selectedScript.sourceFilename || 'uploaded script' }} · {{ selectedScript.status.replace('_', ' ') }}
            </p>
            <div
              v-if="selectedScript.genre || selectedScript.tone || (selectedScript.themes && selectedScript.themes.length)"
              class="flex flex-wrap gap-2 mb-4"
            >
              <span v-if="selectedScript.genre" class="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 capitalize">{{ selectedScript.genre }}</span>
              <span v-if="selectedScript.tone" class="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{{ selectedScript.tone }}</span>
              <span
                v-for="t in (selectedScript.themes ?? [])"
                :key="t"
                class="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600"
              >{{ t }}</span>
            </div>

            <p class="text-sm text-gray-700 whitespace-pre-wrap mb-6">
              {{ selectedScript.synopsis || 'No synopsis available yet.' }}
            </p>

            <div class="border-t border-gray-200 pt-5 mb-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Next steps</h3>
              <p class="text-sm text-gray-600 mb-3">
                After analysis, add comparable-film + theme treatment prose, and/or run the three-act breakdown pass (you can do either order; breakdown can fill both if treatment is still empty).
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  :disabled="!!stepAction || uploading"
                  @click="runGenerateTreatment"
                >
                  {{ stepAction === 'treatment' ? 'Working…' : 'Generate treatment' }}
                </button>
                <button
                  type="button"
                  class="px-4 py-2 border border-gray-300 text-gray-900 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  :disabled="!!stepAction || uploading"
                  @click="runWizardBreakdown"
                >
                  {{ stepAction === 'breakdown' ? 'Working…' : 'Run Script Wizard breakdown' }}
                </button>
              </div>
              <div
                v-if="stepAction"
                class="mt-4 rounded-xl border border-primary/25 bg-white/90 p-5"
              >
                <FilmReelLoader
                  size="sm"
                  :label="stepAction === 'treatment' ? 'Writing treatment' : 'Mapping three-act breakdown'"
                  :sub-label="stepAction === 'treatment'
                    ? 'Comparable films + theme exploration (OpenRouter). Large scripts can take many minutes.'
                    : 'Three-act thematic lens + theme arc (second OpenRouter pass).'"
                />
              </div>
            </div>

            <div class="border-t border-gray-200 pt-5 mb-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Treatment notes</h3>
              <p class="text-sm text-gray-600 mb-3">
                Comparable films and theme exploration (same structure as project import).
              </p>
              <pre
                v-if="hasTreatmentProse"
                class="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed rounded-lg border border-gray-200 bg-gray-50 p-4 max-h-[min(70vh,28rem)] overflow-y-auto"
              >{{ selectedScript.treatment }}</pre>
              <p v-else class="text-sm text-gray-500">
                Not generated yet — use “Generate treatment” or “Run Script Wizard breakdown” above.
              </p>
            </div>

            <div class="border-t border-gray-200 pt-5 mb-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Three-act thematic breakdown</h3>
              <p class="text-sm text-gray-600 mb-3">
                Appended when you run the breakdown pass (or included if you only run breakdown with no treatment yet).
              </p>
              <pre
                v-if="threeActBreakdown"
                class="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed rounded-lg border border-gray-200 bg-gray-50 p-4"
              >{{ threeActBreakdown }}</pre>
              <p v-else class="text-sm text-gray-500">
                No act breakdown yet — run “Script Wizard breakdown” above.
              </p>
            </div>

            <div class="border-t border-gray-200 pt-5">
              <div class="flex items-center justify-between gap-3 mb-2">
                <h3 class="text-lg font-semibold text-gray-900">Similar movies</h3>
                <button
                  type="button"
                  class="px-3 py-1.5 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:opacity-50"
                  :disabled="loadingMovies"
                  @click="loadMovies(selectedScript.id)"
                >
                  {{ loadingMovies ? 'Refreshing…' : 'Refresh' }}
                </button>
              </div>
              <p class="text-sm text-gray-600 mb-4">
                Based on comparable films extracted from this script's analysis.
              </p>

              <div v-if="loadingMovies" class="py-4">
                <FilmReelLoader
                  size="sm"
                  label="Cueing comparable films"
                  sub-label="Looking up titles from your analysis…"
                />
              </div>
              <p v-else-if="moviesError" class="text-sm text-red-700">{{ moviesError }}</p>
              <ul v-else-if="movies.length" class="grid sm:grid-cols-2 gap-4">
                <li
                  v-for="m in movies"
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
              <p v-else class="text-sm text-gray-500">No similar movies yet for this script.</p>
              <p v-if="candidates.length && !movies.length" class="text-xs text-gray-500 mt-3">
                Extracted titles: {{ candidates.map(c => c.title).join(', ') }}
              </p>
            </div>
          </template>
        </div>
      </div>
      </template>
      <template #fallback>
        <div class="rounded-xl border border-gray-200 bg-gray-50 px-6 py-10">
          <FilmReelLoader
            size="md"
            label="Loading Script Wizard"
            sub-label="Preparing your workspace…"
          />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { extractThreeActBreakdownFromTreatment } from '~/lib/extract-three-act-from-treatment'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { SCRIPT_WIZARD_STEP_CLIENT_MS, SCRIPT_WIZARD_UPLOAD_CLIENT_MS } from '~/lib/script-wizard-timeouts'
import type { CreativeScript } from '~/types/creative-script'

type ComparableCandidate = { title: string; year?: string }
type WizardMovie = {
  title: string
  year?: string
  imdbId?: string
  genre?: string
  plot?: string
  poster?: string
  imdbRating?: string
  rottenTomatoes?: string
}

const { isAuthenticated, getAuthToken } = useAuth()
const toast = useToast()

const selectedFile = ref<File | null>(null)
const uploadError = ref('')
const uploading = ref(false)

const scripts = ref<CreativeScript[]>([])
const selectedScriptId = ref('')
const loadingScripts = ref(false)
const scriptsError = ref('')

const movies = ref<WizardMovie[]>([])
const candidates = ref<ComparableCandidate[]>([])
const loadingMovies = ref(false)
const moviesError = ref('')
const stepAction = ref<null | 'treatment' | 'breakdown'>(null)

const uploadStatusHint =
  'Extracting text and running AI analysis (synopsis, genre, comparable titles). Long scripts can take 10–30 minutes — stay on this page until it finishes.'

const selectedScript = computed(() =>
  scripts.value.find(s => s.id === selectedScriptId.value) || null
)
const threeActBreakdown = computed(() =>
  extractThreeActBreakdownFromTreatment(selectedScript.value?.treatment || '')
)

const hasTreatmentProse = computed(() => {
  const t = selectedScript.value?.treatment?.trim() || ''
  return t.length > 0
})

function formatDate (iso: string): string {
  if (!iso) return 'unknown'
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

function onFileChange (e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

async function loadScripts () {
  const token = getAuthToken()
  if (!token || !isAuthenticated.value) return
  loadingScripts.value = true
  scriptsError.value = ''
  try {
    const res = await $fetch<{ items: CreativeScript[] }>('/api/script-wizard/scripts', {
      headers: { Authorization: `Bearer ${token}` }
    })
    scripts.value = res.items || []
    if (!selectedScriptId.value && scripts.value.length) {
      selectedScriptId.value = scripts.value[0]!.id
      void loadMovies(selectedScriptId.value)
    }
  } catch (e: unknown) {
    scriptsError.value = formatApiFetchError(e, 'Could not load scripts')
  } finally {
    loadingScripts.value = false
  }
}

async function uploadScript () {
  const token = getAuthToken()
  if (!token || !selectedFile.value) return
  uploading.value = true
  uploadError.value = ''
  try {
    const form = new FormData()
    form.append('file', selectedFile.value)
    form.append('status', 'in_progress')
    const res = await $fetch<{ script: CreativeScript; notice?: string; warning?: string }>(
      '/api/script-wizard/scripts',
      {
        method: 'POST',
        body: form,
        headers: { Authorization: `Bearer ${token}` },
        timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
      }
    )
    const newId = res.script.id
    selectedFile.value = null
    selectedScriptId.value = newId
    toast.showToast('Analysis saved. Use Generate treatment or Run Script Wizard breakdown next.', 'success')
    if (res.notice) {
      toast.showToast(res.notice, 'info')
    }
    if (res.warning) {
      toast.showToast(res.warning, 'info')
    }
    await loadScripts()
    await loadMovies(newId)
  } catch (e: unknown) {
    const msg = formatApiFetchError(e, 'Upload failed')
    uploadError.value = msg
    toast.showToast(msg, 'error')
  } finally {
    uploading.value = false
  }
}

async function runGenerateTreatment () {
  const id = selectedScriptId.value
  const token = getAuthToken()
  if (!token || !id) return
  stepAction.value = 'treatment'
  try {
    await $fetch<{ script: CreativeScript }>(`/api/script-wizard/scripts/${id}/treatment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      timeout: SCRIPT_WIZARD_STEP_CLIENT_MS
    })
    await loadScripts()
    selectedScriptId.value = id
    await loadMovies(id)
    toast.showToast('Treatment saved.', 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Treatment step failed'), 'error')
  } finally {
    stepAction.value = null
  }
}

async function runWizardBreakdown () {
  const id = selectedScriptId.value
  const token = getAuthToken()
  if (!token || !id) return
  stepAction.value = 'breakdown'
  try {
    const res = await $fetch<{ script: CreativeScript; notice?: string }>(
      `/api/script-wizard/scripts/${id}/wizard-breakdown`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        timeout: SCRIPT_WIZARD_STEP_CLIENT_MS
      }
    )
    await loadScripts()
    selectedScriptId.value = id
    await loadMovies(id)
    const n = res.notice || ''
    if (!n) {
      toast.showToast('Breakdown saved.', 'success')
    } else if (/returned empty/i.test(n)) {
      toast.showToast(n, 'warning')
    } else if (/already has a three-act/i.test(n)) {
      toast.showToast(n, 'info')
    } else {
      toast.showToast(n, 'success')
    }
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Breakdown step failed'), 'error')
  } finally {
    stepAction.value = null
  }
}

async function loadMovies (scriptId: string) {
  const token = getAuthToken()
  if (!token || !scriptId) return
  loadingMovies.value = true
  moviesError.value = ''
  try {
    const res = await $fetch<{ candidates: ComparableCandidate[]; movies: WizardMovie[] }>(
      `/api/script-wizard/scripts/${scriptId}/movies`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    candidates.value = res.candidates || []
    movies.value = res.movies || []
  } catch (e: unknown) {
    moviesError.value = formatApiFetchError(e, 'Could not load similar movies')
  } finally {
    loadingMovies.value = false
  }
}

function selectScript (id: string) {
  selectedScriptId.value = id
  void loadMovies(id)
}

watch(
  () => isAuthenticated.value,
  (ok) => {
    if (ok) {
      void loadScripts()
    } else {
      scripts.value = []
      selectedScriptId.value = ''
      movies.value = []
      candidates.value = []
      scriptsError.value = ''
      moviesError.value = ''
    }
  },
  { immediate: true }
)
</script>

