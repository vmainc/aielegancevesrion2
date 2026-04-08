<template>
  <div class="max-w-4xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">Storyboard</span>
      · After scenes exist, use <span class="font-medium text-gray-700">Generate panels from scenes</span> for an import-style batch (first 28 scenes, two at a time), or pick a scene and use
      <span class="text-gray-700">Generate Shots</span>
      for a continuity-aware refresh. Then
      <span class="text-gray-700">Generate frame</span>
      from each shot’s image prompt.
    </p>

    <div
      v-if="!clientReady"
      class="rounded-xl border border-primary/20 bg-primary/5 px-6 py-10"
    >
      <FilmReelLoader
        size="md"
        label="Loading storyboard"
        sub-label="Preparing your workspace…"
      />
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
          Run director analysis on Overview, generate scenes on the Scenes tab, then return here to batch panels or generate shots per scene.
        </p>
        <NuxtLink
          to="/projects"
          class="inline-flex px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors"
        >
          Go to Projects
        </NuxtLink>
      </div>

      <div v-else class="space-y-8 mb-10">
        <div class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div class="min-w-0">
              <h2 class="text-base font-semibold text-gray-900 mb-1">Generate panels from scenes</h2>
              <p class="text-sm text-gray-600">
                Import-style batch: shot lists for the first {{ storyboardSceneCap }} scenes using your Director notes and cast (two scenes at a time). For a continuity pass on one beat, use <span class="font-medium text-gray-800">Generate Shots</span> below.
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 px-4 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              :disabled="seedingStoryboard || generating"
              @click="seedStoryboardBatch"
            >
              {{ seedingStoryboard ? 'Working…' : 'Generate panels from scenes' }}
            </button>
          </div>
          <div
            v-if="seedingStoryboard"
            class="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-5"
          >
            <FilmReelLoader
              size="sm"
              label="Building shot lists"
              sub-label="Claude is working through your scenes — large projects can take several minutes."
            />
          </div>
        </div>

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
                  v-for="(s, idx) in scenes"
                  :key="s.id"
                  :value="s.id"
                >
                  SCENE {{ idx + 1 }} — {{ s.heading }}
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
          <div
            v-if="generating"
            class="mt-4 rounded-xl border border-primary/20 bg-white p-5"
          >
            <FilmReelLoader
              size="sm"
              label="Generating shots"
              sub-label="Continuity-aware pass for this scene…"
            />
          </div>
        </div>

        <div
          v-if="shotsLoading"
          class="rounded-xl border border-primary/15 bg-gray-50 p-5"
        >
          <FilmReelLoader
            size="sm"
            label="Loading shots"
            sub-label="Fetching panels for the selected scene…"
          />
        </div>

        <div v-else-if="!shots.length && !generating" class="text-sm text-gray-500">
          No shots for this scene yet — it may be past the import auto-board limit, or generation failed. Click
          <span class="text-gray-700">Generate Shots</span>
          to build a list (replaces any previous shots for this scene).
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
                <div class="flex justify-between items-start gap-2 mb-1">
                  <label class="text-xs font-medium text-gray-500">Description</label>
                  <PromptEnhanceButton v-model="shot.description" context="story" />
                </div>
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
                    <div class="flex justify-between items-center gap-2 mb-1">
                      <label class="text-xs font-medium text-gray-500">Image prompt</label>
                      <PromptEnhanceButton v-model="shot.imagePrompt" context="shot_image" />
                    </div>
                    <textarea
                      v-model="shot.imagePrompt"
                      rows="3"
                      class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
                    />
                    <div class="flex flex-wrap items-center gap-2 mt-2">
                      <button
                        type="button"
                        class="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                        :disabled="
                          imageGenId === shot.id ||
                          !((shot.imagePrompt || shot.description || '').trim())
                        "
                        @click="generateFrame(shot)"
                      >
                        {{ imageGenId === shot.id ? 'Generating…' : 'Generate frame' }}
                      </button>
                    </div>
                    <div
                      v-if="framePreview[shot.id]"
                      class="mt-3 rounded-lg border border-gray-200 overflow-hidden bg-gray-100"
                    >
                      <img
                        :src="framePreview[shot.id]"
                        alt=""
                        class="w-full max-h-80 object-contain"
                      >
                    </div>
                  </div>
                  <div>
                    <div class="flex justify-between items-center gap-2 mb-1">
                      <label class="text-xs font-medium text-gray-500">Video prompt</label>
                      <PromptEnhanceButton v-model="shot.videoPrompt" context="shot_video" />
                    </div>
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

      <div class="pt-8 border-t border-gray-200 flex flex-wrap gap-4">
        <NuxtLink
          :to="`/projects/${projectId}/scenes`"
          class="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          ← Scenes
        </NuxtLink>
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
import { SCRIPT_WIZARD_UPLOAD_CLIENT_MS } from '~/lib/script-wizard-timeouts'
import type { CreativeShot } from '~/types/creative-shot'

/** Keep in sync with `IMPORT_STORYBOARD_MAX_SCENES` in server import-storyboard-seed. */
const storyboardSceneCap = 28

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
const seedingStoryboard = ref(false)
const savingId = ref<string | null>(null)
const imageGenId = ref<string | null>(null)
const framePreview = reactive<Record<string, string>>({})

const activeScene = computed(() => scenes.value.find(s => s.id === selectedSceneId.value))

function firstImageUrl (urls: unknown[]): string {
  for (const u of urls) {
    if (typeof u === 'string' && u.trim()) return u.trim()
    if (u && typeof u === 'object' && u !== null && 'url' in u) {
      const url = (u as { url: unknown }).url
      if (typeof url === 'string' && url.trim()) return url.trim()
    }
  }
  return ''
}

async function generateFrame (shot: CreativeShot) {
  const prompt = (shot.imagePrompt || shot.description || '').trim()
  if (!prompt) {
    toast.showToast('Add an image prompt or description first.', 'info')
    return
  }
  imageGenId.value = shot.id
  try {
    const res = await $fetch<{ urls?: unknown[] }>('/api/generate/image', {
      method: 'POST',
      body: { prompt }
    })
    const url = firstImageUrl(res.urls || [])
    if (url) {
      framePreview[shot.id] = url
      toast.showToast('Frame generated.', 'success')
    } else {
      toast.showToast('No image returned.', 'error')
    }
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Image generation failed')
        : 'Image generation failed'
    toast.showToast(msg, 'error')
  } finally {
    imageGenId.value = null
  }
}

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

async function seedStoryboardBatch () {
  const id = projectId.value
  const headers = await authHeaders()
  if (!id || !headers) {
    toast.showToast('Log in to generate panels.', 'error')
    return
  }
  seedingStoryboard.value = true
  try {
    const res = await $fetch<{
      result: { ok: number; failed: number; capSkipped: number; emptySkipped: number }
    }>(`/api/projects/${id}/script/seed-storyboard`, {
      method: 'POST',
      headers,
      timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
    })
    const r = res.result
    const parts: string[] = [`Seeded ${r.ok} scene(s).`]
    if (r.failed > 0) parts.push(`${r.failed} failed.`)
    if (r.capSkipped > 0) parts.push(`${r.capSkipped} past the first ${storyboardSceneCap}.`)
    if (r.emptySkipped > 0) parts.push(`${r.emptySkipped} skipped (empty).`)
    toast.showToast(parts.join(' '), r.ok > 0 ? 'success' : 'info')
    await loadShots()
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Storyboard seed failed.')
        : 'Storyboard seed failed.'
    toast.showToast(msg, 'error')
  } finally {
    seedingStoryboard.value = false
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
