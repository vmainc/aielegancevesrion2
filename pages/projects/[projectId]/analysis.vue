<template>
  <div class="max-w-4xl">
    <p class="text-sm text-gray-500 mb-6">
      Script Wizard: import a screenplay for this project and review similar movies (from OMDb) using the project treatment’s comparable film list.
    </p>

    <div v-if="!activeProject" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-6">
      Open a project from the workflow to use Script Wizard.
    </div>

    <template v-else-if="!canUseCloud">
      <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 mb-6">
        Sign in and open a cloud project to import scripts and fetch similar movies.
      </div>
    </template>

    <template v-else>
      <div class="rounded-xl border border-gray-200 bg-gray-50 p-6 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Import or replace script</h2>
        <p class="text-sm text-gray-600 mb-4">
          Upload Final Draft, PDF, or TXT for this project. Script Wizard will refresh scenes, characters, director notes, and comparable movies.
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
            class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="importing || !selectedFile"
            @click="runImport"
          >
            {{ importing ? 'Importing…' : 'Import Script to This Project' }}
          </button>
        </div>
        <p v-if="importError" class="mt-3 text-sm text-red-700">{{ importError }}</p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 mb-8">
        <div class="flex items-center justify-between gap-3 mb-3">
          <h2 class="text-lg font-semibold text-gray-900">Similar movies</h2>
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 transition-colors disabled:opacity-50"
            :disabled="loadingMovies"
            @click="loadMovies"
          >
            {{ loadingMovies ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
        <p class="text-sm text-gray-600 mb-5">
          Based on comparable titles extracted from the project treatment, enriched with OMDb metadata.
        </p>

        <div v-if="loadingMovies" class="text-sm text-gray-500">Loading movies…</div>
        <p v-else-if="moviesError" class="text-sm text-red-700">{{ moviesError }}</p>
        <template v-else-if="movies.length">
          <ul class="grid sm:grid-cols-2 gap-4">
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
        </template>
        <p v-else class="text-sm text-gray-500">
          No similar movies yet. Import a script (or ensure treatment contains "Comparable films") and refresh.
        </p>
      </div>

      <p v-if="candidates.length && !movies.length" class="text-xs text-gray-500 mb-6">
        Extracted titles: {{ candidates.map(c => c.title).join(', ') }}
      </p>
    </template>

    <NuxtLink :to="`/projects/${projectId}/overview`" class="text-sm text-gray-600 hover:text-primary transition-colors">
      ← Back to Overview
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
type ComparableCandidate = { title: string; year?: string }
type WizardMovie = {
  title: string
  year?: string
  imdbId?: string
  genre?: string
  director?: string
  actors?: string
  plot?: string
  poster?: string
  imdbRating?: string
  rottenTomatoes?: string
  metascore?: string
}

const PB_ID = /^[a-z0-9]{15}$/

const { activeProjectId, activeProject, registerImportedProject } = useCreativeProject()
const { getAuthToken, isAuthenticated } = useAuth()
const toast = useToast()

const projectId = activeProjectId
const selectedFile = ref<File | null>(null)
const importing = ref(false)
const importError = ref('')

const loadingMovies = ref(false)
const moviesError = ref('')
const movies = ref<WizardMovie[]>([])
const candidates = ref<ComparableCandidate[]>([])

const canUseCloud = computed(
  () => !!activeProject.value && isAuthenticated.value && PB_ID.test(projectId.value)
)

function onFileChange (e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  selectedFile.value = f || null
}

async function runImport () {
  const token = getAuthToken()
  const p = activeProject.value
  if (!token || !p || !selectedFile.value || !PB_ID.test(p.id)) return

  importing.value = true
  importError.value = ''
  try {
    const form = new FormData()
    form.append('file', selectedFile.value)
    form.append('aspectRatio', p.aspectRatio || '16:9')
    form.append('goal', p.goal || 'film')
    const res = await $fetch<{ project: import('~/types/creative-project').CreativeProject }>(
      `/api/projects/${p.id}/import-script`,
      {
        method: 'POST',
        body: form,
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    registerImportedProject(res.project)
    toast.showToast('Script imported for this project.', 'success')
    await loadMovies()
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Import failed')
        : 'Import failed'
    importError.value = msg
    toast.showToast(msg, 'error')
  } finally {
    importing.value = false
  }
}

async function loadMovies () {
  const token = getAuthToken()
  const id = projectId.value
  if (!token || !PB_ID.test(id)) return
  loadingMovies.value = true
  moviesError.value = ''
  try {
    const res = await $fetch<{ candidates: ComparableCandidate[]; movies: WizardMovie[] }>(
      `/api/projects/${id}/script-wizard/movies`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    candidates.value = res.candidates || []
    movies.value = res.movies || []
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load similar movies')
        : 'Could not load similar movies'
    moviesError.value = msg
  } finally {
    loadingMovies.value = false
  }
}

watch(
  [canUseCloud, projectId],
  ([ok]) => {
    if (ok) void loadMovies()
    else {
      candidates.value = []
      movies.value = []
      moviesError.value = ''
    }
  },
  { immediate: true }
)
</script>
