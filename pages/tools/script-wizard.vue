<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Script Wizard</h1>
      <p class="text-sm text-gray-600 max-w-3xl">
        Standalone script workspace. Upload finished or unfinished scripts, iterate in one library, then attach scripts to projects in later workflow steps.
      </p>
    </div>

    <div v-if="!isAuthenticated" class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
      Sign in to use Script Wizard.
    </div>

    <template v-else>
      <div class="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-2">Upload script</h2>
        <p class="text-sm text-gray-600 mb-4">
          Upload Final Draft, PDF, or TXT. We store the script as a reusable library item and run summary + comparable-film analysis.
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".fdx,.pdf,.txt,text/plain,application/pdf,application/xml,text/xml"
            class="text-sm"
            @change="onFileChange"
          >
          <button
            type="button"
            class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            :disabled="uploading || !selectedFile"
            @click="uploadScript"
          >
            {{ uploading ? 'Uploading…' : 'Add to Script Wizard' }}
          </button>
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
          <p v-else-if="loadingScripts" class="p-4 text-sm text-gray-500">Loading scripts…</p>
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
          <p v-else class="p-4 text-sm text-gray-500">No scripts yet. Upload your first script above.</p>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <template v-if="!selectedScript">
            <p class="text-sm text-gray-500">Select a script to view analysis and similar movies.</p>
          </template>
          <template v-else>
            <h2 class="text-xl font-semibold text-gray-900 mb-1">{{ selectedScript.title }}</h2>
            <p class="text-xs text-gray-500 mb-4">
              {{ selectedScript.sourceFilename || 'uploaded script' }} · {{ selectedScript.status.replace('_', ' ') }}
            </p>
            <p class="text-sm text-gray-700 whitespace-pre-wrap mb-6">
              {{ selectedScript.synopsis || 'No synopsis available yet.' }}
            </p>

            <div class="border-t border-gray-200 pt-5 mb-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Three-act thematic breakdown</h3>
              <p class="text-sm text-gray-600 mb-3">
                Script Wizard maps the story into acts so theme progression is easier to inspect.
              </p>
              <pre
                v-if="threeActBreakdown"
                class="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed rounded-lg border border-gray-200 bg-gray-50 p-4"
              >{{ threeActBreakdown }}</pre>
              <p v-else class="text-sm text-gray-500">
                No act breakdown on this script yet. Re-upload to regenerate with three-act analysis.
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

              <div v-if="loadingMovies" class="text-sm text-gray-500">Loading movies…</div>
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
  </div>
</template>

<script setup lang="ts">
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

const selectedScript = computed(() =>
  scripts.value.find(s => s.id === selectedScriptId.value) || null
)
const threeActBreakdown = computed(() => {
  const t = selectedScript.value?.treatment || ''
  if (!t) return ''
  const m = t.match(/Three-act thematic breakdown\s*\n([\s\S]*)$/i)
  return m ? m[1]!.trim() : ''
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
    scriptsError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load scripts')
        : 'Could not load scripts'
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
    const res = await $fetch<{ script: CreativeScript }>('/api/script-wizard/scripts', {
      method: 'POST',
      body: form,
      headers: { Authorization: `Bearer ${token}` }
    })
    scripts.value = [res.script, ...scripts.value.filter(s => s.id !== res.script.id)]
    selectedScriptId.value = res.script.id
    selectedFile.value = null
    toast.showToast('Script added to Script Wizard.', 'success')
    await loadMovies(res.script.id)
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Upload failed')
        : 'Upload failed'
    uploadError.value = msg
    toast.showToast(msg, 'error')
  } finally {
    uploading.value = false
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
    moviesError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load similar movies')
        : 'Could not load similar movies'
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

