<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Storyboard Builder</h1>
      <p class="text-sm text-gray-600 max-w-3xl">
        Build a scene board-by-board — no script import or director step required. Each scene starts with one panel; add more as you go, upload or generate frames, then continue to video when ready.
      </p>
    </div>

    <ClientOnly>
      <div v-if="!isAuthenticated" class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        <NuxtLink to="/login" class="text-primary font-medium underline">Sign in</NuxtLink>
        to use Storyboard Builder.
      </div>

      <template v-else>
        <div class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-2">New scene</h2>
          <p class="text-sm text-gray-600 mb-4">
            Name your scene and start with a single blank board. You can add panels, upload images, or generate frames on the next screen.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div class="flex-1 min-w-0">
              <label for="scene-heading" class="block text-xs font-medium text-gray-500 mb-1">Scene title</label>
              <input
                id="scene-heading"
                v-model="sceneHeading"
                type="text"
                maxlength="200"
                placeholder="INT. COFFEE SHOP — DAY"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
                @keydown.enter.prevent="startScene"
              >
            </div>
            <button
              type="button"
              class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
              :disabled="creating || !sceneHeading.trim()"
              @click="startScene"
            >
              {{ creating ? 'Creating…' : 'Start scene' }}
            </button>
          </div>
          <p v-if="createError" class="mt-3 text-sm text-red-700">{{ createError }}</p>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-700">Your builder scenes</h2>
            <button
              type="button"
              class="text-xs px-2.5 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
              :disabled="loadingScenes"
              @click="loadScenes"
            >
              {{ loadingScenes ? 'Loading…' : 'Refresh' }}
            </button>
          </div>
          <p v-if="scenesError" class="p-4 text-sm text-red-700">{{ scenesError }}</p>
          <div v-else-if="loadingScenes" class="p-6">
            <FilmReelLoader size="sm" label="Loading scenes" sub-label="Fetching your storyboards…" />
          </div>
          <ul v-else-if="scenes.length" class="divide-y divide-gray-200">
            <li v-for="(s, idx) in scenes" :key="s.id">
              <button
                type="button"
                class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                @click="openScene(s.id)"
              >
                <div class="min-w-0">
                  <p class="font-medium text-gray-900 truncate">
                    Scene {{ idx + 1 }} — {{ s.heading }}
                  </p>
                  <p v-if="s.summary" class="text-xs text-gray-500 mt-0.5 truncate">{{ s.summary }}</p>
                </div>
                <span class="text-xs text-gray-500 shrink-0">
                  {{ s.shotCount || 0 }} board{{ (s.shotCount || 0) === 1 ? '' : 's' }}
                </span>
              </button>
            </li>
          </ul>
          <p v-else class="p-4 text-sm text-gray-500">
            No scenes yet. Start one above — it begins with a single board.
          </p>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { formatApiFetchError } from '~/lib/format-api-fetch-error'

type SceneRow = {
  id: string
  sortOrder: number
  heading: string
  summary: string
  shotCount?: number
}

const { isAuthenticated, getAuthToken } = useAuth()
const router = useRouter()

const sceneHeading = ref('')
const creating = ref(false)
const createError = ref('')
const builderProjectId = ref('')
const scenes = ref<SceneRow[]>([])
const loadingScenes = ref(false)
const scenesError = ref('')

useHead({ title: 'Storyboard Builder' })

async function loadBuilderProject () {
  const token = getAuthToken()
  if (!token || !isAuthenticated.value) {
    builderProjectId.value = ''
    return
  }
  try {
    const res = await $fetch<{ projectId: string }>('/api/storyboard-builder/library-project', {
      headers: { Authorization: `Bearer ${token}` }
    })
    builderProjectId.value = res.projectId || ''
  } catch {
    builderProjectId.value = ''
  }
}

async function loadScenes () {
  scenesError.value = ''
  const token = getAuthToken()
  const pid = builderProjectId.value
  if (!token || !pid) {
    scenes.value = []
    return
  }
  loadingScenes.value = true
  try {
    const res = await $fetch<{ scenes: SceneRow[] }>(`/api/projects/${pid}/scenes`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    scenes.value = (res.scenes || []).slice().reverse()
  } catch (e: unknown) {
    scenes.value = []
    scenesError.value = formatApiFetchError(e, 'Could not load scenes')
  } finally {
    loadingScenes.value = false
  }
}

async function startScene () {
  const heading = sceneHeading.value.trim()
  if (!heading) return
  const token = getAuthToken()
  if (!token) return
  creating.value = true
  createError.value = ''
  try {
    const res = await $fetch<{
      projectId: string
      scene: { id: string }
    }>('/api/storyboard-builder/scenes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { heading }
    })
    builderProjectId.value = res.projectId
    await router.push(
      `/projects/${res.projectId}/storyboard?builder=1&scene=${encodeURIComponent(res.scene.id)}`
    )
  } catch (e: unknown) {
    createError.value = formatApiFetchError(e, 'Could not create scene')
  } finally {
    creating.value = false
  }
}

function openScene (sceneId: string) {
  const pid = builderProjectId.value
  if (!pid) return
  void router.push(`/projects/${pid}/storyboard?builder=1&scene=${encodeURIComponent(sceneId)}`)
}

watch(
  () => isAuthenticated.value,
  () => {
    void loadBuilderProject().then(() => loadScenes())
  },
  { immediate: true }
)
</script>
