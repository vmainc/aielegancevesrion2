<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">Scenes</span>
      · Add scenes manually below, or run <span class="font-medium text-gray-700">Generate scenes from screenplay</span> after director analysis — Claude uses your current Director notes and replaces the whole scene list. Refine shots on the Storyboard tab.
    </p>

    <div
      v-if="!activeProject"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Open a project from the workflow to use this step.
    </div>

    <template v-else-if="!canLoadCloud">
      <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 mb-6">
        Scene lists are stored with account projects. Sign in and open a cloud project to load this data.
      </div>
    </template>

    <template v-else>
      <div
        class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-6 shadow-sm"
      >
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-gray-900 mb-1">Generate from screenplay</h2>
            <p class="text-sm text-gray-600">
              Rebuilds the entire scene list from your saved Overview screenplay, using your latest genre, tone, and Director-tab bible. Manual scenes below will be removed when you run this.
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 px-4 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            :disabled="generatingScenes || addingScene || pending"
            @click="generateScenesFromScript"
          >
            {{ generatingScenes ? 'Working…' : 'Generate scenes from screenplay' }}
          </button>
        </div>
        <div
          v-if="generatingScenes"
          class="rounded-xl border border-primary/20 bg-primary/5 p-6 mb-6"
        >
          <FilmReelLoader
            size="sm"
            label="Breaking down the screenplay"
            :sub-label="generateScenesHint"
          />
        </div>
        <p v-if="generateScenesError" class="text-sm text-red-700 mb-4">{{ generateScenesError }}</p>
      </div>

      <div
        class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-6 shadow-sm"
      >
        <h2 class="text-base font-semibold text-gray-900 mb-1">Add a scene</h2>
        <p class="text-sm text-gray-600 mb-4">
          You don’t need a script — give each beat a title and a short description. They appear in order below and on Storyboard.
        </p>
        <div class="space-y-3 max-w-lg">
          <div>
            <label for="scene-title" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              id="scene-title"
              v-model="newSceneTitle"
              type="text"
              maxlength="2000"
              placeholder="e.g. INT. COFFEE SHOP — DAY"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
              :disabled="addingScene"
            >
          </div>
          <div>
            <label for="scene-desc" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              id="scene-desc"
              v-model="newSceneDescription"
              rows="3"
              maxlength="5000"
              placeholder="What happens in this scene — beats, tone, or dialogue you care about."
              class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
              :disabled="addingScene"
            />
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              :disabled="addingScene || !newSceneTitle.trim()"
              @click="addScene"
            >
              {{ addingScene ? 'Adding…' : 'Add scene' }}
            </button>
          </div>
          <p v-if="addSceneError" class="text-sm text-red-700">{{ addSceneError }}</p>
        </div>
      </div>

      <div
        v-if="pending"
        class="rounded-xl border border-primary/20 bg-primary/5 p-6 mb-4"
      >
        <FilmReelLoader
          size="sm"
          label="Loading scenes"
          sub-label="Fetching your scene list…"
        />
      </div>
      <div
        v-else-if="loadError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      >
        {{ loadError }}
      </div>
      <template v-else-if="scenes.length">
        <p class="text-sm text-gray-600 mb-4">
          {{ scenes.length }} scene(s) in order. Each row is an accordion: the header is the slug line; open it for full dialogue and action (same text the Storyboard step uses for shots).
        </p>
        <ul class="space-y-3">
          <li
            v-for="(s, idx) in scenes"
            :key="s.id"
            class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              class="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
              :aria-expanded="expandedId === s.id"
              @click="toggleExpand(s.id)"
            >
              <span class="min-w-0 flex-1">
                <span class="font-semibold text-gray-900 block leading-snug">
                  <span class="text-primary font-mono text-xs tracking-wide uppercase">Scene {{ idx + 1 }}</span>
                  <span class="text-gray-400 font-normal mx-1.5" aria-hidden="true">—</span>
                  <span>{{ s.heading }}</span>
                </span>
                <span class="text-sm text-gray-600 line-clamp-2 mt-1 block">{{ s.summary || '—' }}</span>
              </span>
              <span class="text-xs text-gray-400 shrink-0 mt-0.5">{{ expandedId === s.id ? '▼' : '▶' }}</span>
            </button>
            <div
              v-if="expandedId === s.id"
              class="border-t border-gray-100 px-4 py-3 bg-gray-50/80 text-sm"
            >
              <p v-if="detailError" class="text-red-700 text-sm mb-2">{{ detailError }}</p>
              <div
                v-else-if="detailLoading"
                class="py-2"
              >
                <FilmReelLoader
                  size="sm"
                  label="Loading excerpt"
                  sub-label="Fetching scene body from the server…"
                />
              </div>
              <template v-else>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Script for this scene
                </p>
                <pre
                  class="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed max-h-[min(70vh,28rem)] overflow-y-auto"
                >{{ detailBody || '—' }}</pre>
              </template>
              <NuxtLink
                :to="`/projects/${projectId}/storyboard`"
                class="inline-block mt-3 text-sm text-primary font-medium hover:underline"
              >
                Storyboard → build shots for this project
              </NuxtLink>
            </div>
          </li>
        </ul>
      </template>
      <div v-else class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-600">
        No scenes yet. Run <span class="font-medium text-gray-800">Generate scenes from screenplay</span> above (after director analysis), or add a scene manually.
      </div>
    </template>

    <div class="mt-10 pt-8 border-t border-gray-200 flex flex-wrap gap-4">
      <NuxtLink
        :to="`/projects/${projectId}/characters`"
        class="text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        ← Characters
      </NuxtLink>
      <NuxtLink
        :to="`/projects/${projectId}/storyboard`"
        class="text-sm text-primary font-medium hover:underline"
      >
        Next: Storyboard →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { SCRIPT_WIZARD_UPLOAD_CLIENT_MS } from '~/lib/script-wizard-timeouts'

const PB_ID = /^[a-z0-9]{15}$/

type SceneListRow = {
  id: string
  sortOrder: number
  heading: string
  summary: string
  bodyLength: number
}

const { activeProjectId, activeProject } = useCreativeProject()
const { getAuthToken, isAuthenticated } = useAuth()
const toast = useToast()

const projectId = activeProjectId

const scenes = ref<SceneListRow[]>([])
const loadError = ref<string | null>(null)
const pending = ref(false)

const newSceneTitle = ref('')
const newSceneDescription = ref('')
const addingScene = ref(false)
const addSceneError = ref<string | null>(null)

const expandedId = ref<string | null>(null)
const detailBody = ref('')
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

const generatingScenes = ref(false)
const generateScenesError = ref('')
const generateScenesHint =
  'Claude is splitting your screenplay into scenes — large scripts can take many minutes. Stay on this page.'

const canLoadCloud = computed(
  () =>
    !!activeProject.value &&
    PB_ID.test(projectId.value) &&
    isAuthenticated.value
)

async function loadScenes () {
  if (!canLoadCloud.value) return
  const token = getAuthToken()
  if (!token) return
  loadError.value = null
  pending.value = true
  try {
    const res = await $fetch<{ scenes: SceneListRow[] }>(`/api/projects/${projectId.value}/scenes`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    scenes.value = res.scenes || []
  } catch (e: unknown) {
    loadError.value = formatApiFetchError(e, 'Could not load scenes')
    scenes.value = []
  } finally {
    pending.value = false
  }
}

async function generateScenesFromScript () {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token || !canLoadCloud.value) return
  generatingScenes.value = true
  generateScenesError.value = ''
  try {
    await $fetch(`/api/projects/${id}/script/generate-scenes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {},
      timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
    })
    toast.showToast('Scenes generated from screenplay.', 'success')
    expandedId.value = null
    detailBody.value = ''
    await loadScenes()
  } catch (e: unknown) {
    const msg = formatApiFetchError(e, 'Could not generate scenes')
    generateScenesError.value = msg
    toast.showToast(msg, 'error')
  } finally {
    generatingScenes.value = false
  }
}

async function addScene () {
  const title = newSceneTitle.value.trim()
  if (!title || !canLoadCloud.value) return
  const token = getAuthToken()
  if (!token) {
    addSceneError.value = 'Please sign in again.'
    return
  }
  addingScene.value = true
  addSceneError.value = null
  try {
    await $fetch(`/api/projects/${projectId.value}/scenes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        heading: title,
        description: newSceneDescription.value.trim()
      }
    })
    newSceneTitle.value = ''
    newSceneDescription.value = ''
    toast.showToast('Scene added.', 'success')
    await loadScenes()
  } catch (e: unknown) {
    addSceneError.value = formatApiFetchError(e, 'Could not add scene')
  } finally {
    addingScene.value = false
  }
}

async function toggleExpand (id: string) {
  if (expandedId.value === id) {
    expandedId.value = null
    detailBody.value = ''
    detailError.value = null
    return
  }
  expandedId.value = id
  detailBody.value = ''
  detailError.value = null
  detailLoading.value = true
  const token = getAuthToken()
  if (!token) {
    detailLoading.value = false
    detailError.value = 'Please sign in again to load scene details.'
    return
  }
  try {
    const res = await $fetch<{ scene: { body: string } }>(
      `/api/projects/${projectId.value}/scenes/${id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    detailBody.value = res.scene?.body || ''
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load scene')
        : 'Could not load scene'
    detailError.value = msg
  } finally {
    detailLoading.value = false
  }
}

watch(
  [canLoadCloud, projectId],
  ([ok]) => {
    newSceneTitle.value = ''
    newSceneDescription.value = ''
    addSceneError.value = null
    if (ok) void loadScenes()
    else {
      scenes.value = []
      loadError.value = null
      expandedId.value = null
    }
  },
  { immediate: true }
)
</script>
