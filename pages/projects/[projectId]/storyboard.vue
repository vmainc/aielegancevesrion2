<template>
  <div class="max-w-4xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">Step 4 of 5</span>
      · Turn each scene into a cinematic shot list for boards and motion.
    </p>

    <div
      v-if="!clientReady"
      class="text-gray-600 py-8"
    >
      Loading…
    </div>

    <template v-else>
      <div
        v-if="project?.source !== 'pocketbase'"
        class="rounded-xl border border-amber-200 bg-amber-50 p-5 mb-8 text-sm text-amber-900"
      >
        Shot generation saves to your cloud account. Open a project you created after signing in, or import a script from
        <NuxtLink to="/projects" class="underline font-medium text-primary">Projects</NuxtLink>.
      </div>

      <div
        v-else-if="!isAuthenticated"
        class="rounded-xl border border-gray-200 bg-gray-50 p-5 mb-8 text-sm text-gray-700"
      >
        <NuxtLink to="/login" class="text-primary font-medium underline">Log in</NuxtLink>
        to load scenes and generate shots.
      </div>

      <div
        v-else-if="scenesLoadError"
        class="rounded-xl border border-red-200 bg-red-50 p-5 mb-8 text-sm text-red-800"
      >
        {{ scenesLoadError }}
      </div>

      <div
        v-else-if="!scenes.length"
        class="rounded-xl border border-dashed border-gray-300 bg-gray-100 p-8 mb-8"
      >
        <h2 class="text-lg font-semibold text-gray-800 mb-2">No scenes yet</h2>
        <p class="text-sm text-gray-500 mb-6">
          Import a script from Projects to create scenes, then return here to generate shots.
        </p>
        <NuxtLink
          to="/projects"
          class="inline-flex px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors"
        >
          Go to Projects
        </NuxtLink>
      </div>

      <div v-else class="space-y-8 mb-10">
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between">
            <div class="flex-1 min-w-0">
              <label for="scene-pick" class="block text-sm font-medium text-gray-700 mb-2">Scene</label>
              <select
                id="scene-pick"
                v-model="selectedSceneId"
                class="w-full max-w-md px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary text-sm"
              >
                <option
                  v-for="s in scenes"
                  :key="s.id"
                  :value="s.id"
                >
                  {{ s.sortOrder + 1 }}. {{ s.heading }}
                </option>
              </select>
              <p v-if="activeScene?.summary" class="mt-2 text-xs text-gray-500 line-clamp-2">
                {{ activeScene.summary }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              :disabled="generating || !selectedSceneId"
              @click="generateShots"
            >
              {{ generating ? 'Generating cinematic shots…' : 'Generate Shots' }}
            </button>
          </div>
          <p v-if="generateError" class="mt-3 text-sm text-red-600">{{ generateError }}</p>
        </div>

        <div v-if="shotsLoading" class="text-sm text-gray-600 py-4">
          Loading shots…
        </div>

        <div v-else-if="!shots.length && !generating" class="text-sm text-gray-500">
          No shots for this scene yet. Click <span class="text-gray-700">Generate Shots</span> to build a list (replaces any previous shots for this scene).
        </div>

        <ul v-else class="space-y-5">
          <li
            v-for="(shot, idx) in shots"
            :key="shot.id"
            class="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden"
          >
            <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2 bg-gray-50">
              <span class="text-xs font-mono text-primary">#{{ idx + 1 }}</span>
              <span class="text-xs text-gray-500 truncate">{{ shot.shotType }} · {{ shot.durationSeconds }}s</span>
            </div>
            <div class="p-4 sm:p-5 space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input
                  v-model="shot.title"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                >
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea
                  v-model="shot.description"
                  rows="2"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y min-h-[3rem]"
                />
              </div>
              <div class="grid sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Shot type</label>
                  <input
                    v-model="shot.shotType"
                    type="text"
                    class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                  >
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Camera</label>
                  <input
                    v-model="shot.cameraMove"
                    type="text"
                    class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                  >
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Duration (sec)</label>
                  <input
                    v-model.number="shot.durationSeconds"
                    type="number"
                    min="0.5"
                    max="120"
                    step="0.5"
                    class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                  >
                </div>
              </div>
              <details class="group">
                <summary class="cursor-pointer text-sm text-primary font-medium hover:underline">
                  Image &amp; video prompts
                </summary>
                <div class="mt-3 space-y-3 pt-1">
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Image prompt</label>
                    <textarea
                      v-model="shot.imagePrompt"
                      rows="3"
                      class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Video prompt</label>
                    <textarea
                      v-model="shot.videoPrompt"
                      rows="3"
                      class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
                    />
                  </div>
                </div>
              </details>
              <div class="flex justify-end pt-1">
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 transition-colors disabled:opacity-50"
                  :disabled="savingId === shot.id"
                  @click="saveShot(shot)"
                >
                  {{ savingId === shot.id ? 'Saving…' : 'Save changes' }}
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <div class="pt-8 border-t border-gray-200">
        <NuxtLink
          :to="`/projects/${projectId}/video`"
          class="text-sm text-primary font-medium hover:underline"
        >
          Next: Video →
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CreativeShot } from '~/types/creative-shot'

const {
  activeProject,
  activeProjectId,
  clientReady,
  loadServerProjects
} = useCreativeProject()
const { isAuthenticated, getAuthToken } = useAuth()
const toast = useToast()

const projectId = activeProjectId
const project = activeProject

type SceneRow = {
  id: string
  sortOrder: number
  heading: string
  summary: string
  bodyLength: number
}

const scenes = ref<SceneRow[]>([])
const selectedSceneId = ref('')
const scenesLoadError = ref('')
const shots = ref<CreativeShot[]>([])
const shotsLoading = ref(false)
const generating = ref(false)
const generateError = ref('')
const savingId = ref<string | null>(null)

const activeScene = computed(() => scenes.value.find(s => s.id === selectedSceneId.value))

async function authHeaders () {
  const token = getAuthToken()
  if (!token) return null
  return { Authorization: `Bearer ${token}` }
}

async function loadScenes () {
  scenesLoadError.value = ''
  if (project.value?.source !== 'pocketbase' || !isAuthenticated.value) {
    scenes.value = []
    return
  }
  const id = projectId.value
  if (!id) return
  const headers = await authHeaders()
  if (!headers) return
  try {
    const res = await $fetch<{ scenes: SceneRow[] }>(`/api/projects/${id}/scenes`, { headers })
    scenes.value = res.scenes || []
    if (!scenes.value.length) {
      selectedSceneId.value = ''
      shots.value = []
      return
    }
    if (!selectedSceneId.value || !scenes.value.some(s => s.id === selectedSceneId.value)) {
      selectedSceneId.value = scenes.value[0].id
    }
  } catch (e: any) {
    scenes.value = []
    selectedSceneId.value = ''
    shots.value = []
    scenesLoadError.value =
      e?.data?.message || e?.message || 'Could not load scenes.'
  }
}

async function loadShots () {
  generateError.value = ''
  const id = projectId.value
  const sid = selectedSceneId.value
  if (!id || !sid || project.value?.source !== 'pocketbase') {
    shots.value = []
    return
  }
  const headers = await authHeaders()
  if (!headers) {
    shots.value = []
    return
  }
  shotsLoading.value = true
  try {
    const res = await $fetch<{ shots: CreativeShot[] }>(
      `/api/projects/${id}/scenes/${sid}/shots`,
      { headers }
    )
    shots.value = res.shots?.length ? [...res.shots] : []
  } catch {
    shots.value = []
  } finally {
    shotsLoading.value = false
  }
}

async function generateShots () {
  const id = projectId.value
  const sid = selectedSceneId.value
  if (!id || !sid) return
  const headers = await authHeaders()
  if (!headers) {
    generateError.value = 'Log in to generate shots.'
    return
  }
  generating.value = true
  generateError.value = ''
  try {
    const res = await $fetch<{
      shots: CreativeShot[]
      continuity?: { issueCount: number; memoryUpdated: boolean }
    }>('/api/generate-shots', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: { project_id: id, scene_id: sid }
    })
    shots.value = res.shots?.length ? [...res.shots] : []
    await loadServerProjects()
    const n = res.continuity?.issueCount ?? 0
    if (n > 0) {
      toast.showToast(`Shots generated — continuity adjusted ${n} issue(s). See Overview for details.`, 'success')
    } else {
      toast.showToast('Shots generated.', 'success')
    }
  } catch (e: any) {
    generateError.value =
      e?.data?.message || e?.data?.statusMessage || e?.message || 'Generation failed.'
    toast.showToast(generateError.value, 'error')
  } finally {
    generating.value = false
  }
}

async function saveShot (shot: CreativeShot) {
  const id = projectId.value
  const sid = selectedSceneId.value
  if (!id || !sid) return
  const headers = await authHeaders()
  if (!headers) return
  savingId.value = shot.id
  try {
    const res = await $fetch<{ shot: CreativeShot }>(
      `/api/projects/${id}/scenes/${sid}/shots/${shot.id}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: {
          title: shot.title,
          description: shot.description,
          shotType: shot.shotType,
          cameraMove: shot.cameraMove,
          durationSeconds: shot.durationSeconds,
          imagePrompt: shot.imagePrompt,
          videoPrompt: shot.videoPrompt
        }
      }
    )
    const i = shots.value.findIndex(s => s.id === shot.id)
    if (i !== -1) shots.value[i] = res.shot
    toast.showToast('Shot saved.', 'success')
  } catch (e: any) {
    toast.showToast(e?.data?.message || 'Save failed.', 'error')
  } finally {
    savingId.value = null
  }
}

watch(
  () => [clientReady.value, isAuthenticated.value, project.value?.id, project.value?.source] as const,
  () => {
    void loadScenes()
  },
  { immediate: true }
)

watch(selectedSceneId, () => {
  void loadShots()
})
</script>
