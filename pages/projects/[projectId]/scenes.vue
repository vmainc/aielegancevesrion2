<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">Scenes</span>
      · Add scenes manually below, or run <span class="font-medium text-gray-700">Generate scenes from screenplay</span> after director analysis. Open a scene to edit its script, then run <span class="font-medium text-gray-700">Analyze scene</span> to build storyboard panels and check for new characters.
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
        v-if="!scenes.length"
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
          {{ scenes.length }} scene(s) in order. Edit each scene’s script, save, then analyze to generate storyboard panels and spot cast gaps before Storyboard.
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
                <span
                  v-if="s.shotCount && s.shotCount > 0"
                  class="text-xs text-gray-400 mt-1 block"
                >
                  {{ s.shotCount }} storyboard panel{{ s.shotCount === 1 ? '' : 's' }}
                </span>
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
                <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Script for this scene
                  </p>
                  <p
                    v-if="scriptDirty"
                    class="text-xs text-amber-700"
                  >
                    Unsaved changes
                  </p>
                </div>
                <textarea
                  v-model="detailBody"
                  rows="14"
                  maxlength="150000"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 leading-relaxed font-sans resize-y max-h-[min(70vh,32rem)] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                  :disabled="savingScript"
                  placeholder="Dialogue and action for this scene…"
                />
                <div class="flex flex-wrap items-center gap-2 mt-3">
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
                    :disabled="!scriptDirty || savingScript"
                    @click="saveSceneScript(s.id)"
                  >
                    {{ savingScript ? 'Saving…' : 'Save script' }}
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-800 hover:bg-white disabled:opacity-50"
                    :disabled="!scriptDirty || savingScript"
                    @click="revertSceneScript"
                  >
                    Cancel
                  </button>
                </div>
                <p class="text-xs text-gray-500 mt-2">
                  Edit dialogue and action here, then save. The analyser reads your saved script.
                </p>

                <div class="mt-4 pt-4 border-t border-gray-200">
                  <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Scene analyser
                    </p>
                  </div>
                  <p class="text-xs text-gray-600 mb-3">
                    Builds storyboard panels for this scene and lists any characters in the script who are not in your cast yet.
                  </p>
                  <div
                    v-if="analyzingSceneId === s.id"
                    class="rounded-lg border border-primary/20 bg-primary/5 p-4 mb-3"
                  >
                    <FilmReelLoader
                      size="sm"
                      label="Analyzing scene"
                      sub-label="Generating storyboard panels and checking for new characters…"
                    />
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
                      :disabled="!canAnalyzeScene(s) || analyzingSceneId === s.id || savingScript"
                      :title="analyzeDisabledReason(s)"
                      @click="analyzeScene(s.id)"
                    >
                      {{ analyzingSceneId === s.id ? 'Analyzing…' : 'Analyze scene' }}
                    </button>
                    <NuxtLink
                      v-if="s.shotCount && s.shotCount > 0"
                      :to="`/projects/${projectId}/storyboard`"
                      class="text-xs text-primary font-medium hover:underline"
                    >
                      Open storyboard →
                    </NuxtLink>
                  </div>
                  <p
                    v-if="analyzeErrorBySceneId[s.id]"
                    class="text-xs text-red-700 mt-2"
                    role="alert"
                  >
                    {{ analyzeErrorBySceneId[s.id] }}
                  </p>
                  <div
                    v-if="analyzeResultBySceneId[s.id]"
                    class="mt-3 rounded-lg border border-gray-200 bg-white p-3 space-y-3"
                  >
                    <p class="text-sm text-gray-800">
                      Built
                      <span class="font-semibold">{{ analyzeResultBySceneId[s.id]!.shotCount }}</span>
                      storyboard panel{{ analyzeResultBySceneId[s.id]!.shotCount === 1 ? '' : 's' }}.
                      <NuxtLink
                        :to="`/projects/${projectId}/storyboard`"
                        class="text-primary font-medium hover:underline ml-1"
                      >
                        Review on Storyboard →
                      </NuxtLink>
                    </p>
                    <p
                      v-if="analyzeResultBySceneId[s.id]!.warning"
                      class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5"
                    >
                      {{ analyzeResultBySceneId[s.id]!.warning }}
                    </p>
                    <template v-if="analyzeResultBySceneId[s.id]!.newCharacters.length">
                      <p class="text-xs font-medium text-gray-700">
                        New characters in this scene — add them to your cast:
                      </p>
                      <ul class="space-y-2">
                        <li
                          v-for="c in analyzeResultBySceneId[s.id]!.newCharacters"
                          :key="c.name"
                          class="flex flex-wrap items-start justify-between gap-2 text-xs"
                        >
                          <div class="min-w-0">
                            <span class="font-semibold text-gray-900">{{ c.name }}</span>
                            <p
                              v-if="c.roleDescription"
                              class="text-gray-600 mt-0.5 line-clamp-3"
                            >
                              {{ c.roleDescription }}
                            </p>
                          </div>
                          <button
                            type="button"
                            class="shrink-0 text-primary font-medium hover:underline disabled:opacity-40"
                            :disabled="addingCharacterName === c.name"
                            @click="addSuggestedCharacter(c)"
                          >
                            {{ addingCharacterName === c.name ? 'Adding…' : 'Add to cast' }}
                          </button>
                        </li>
                      </ul>
                      <NuxtLink
                        :to="`/projects/${projectId}/characters`"
                        class="inline-block text-xs text-primary font-medium hover:underline"
                      >
                        Characters tab →
                      </NuxtLink>
                    </template>
                    <p
                      v-else
                      class="text-xs text-gray-600"
                    >
                      All named characters in this scene are already in your cast.
                    </p>
                  </div>
                </div>
              </template>
            </div>
          </li>
        </ul>
      </template>
      <div v-else class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-600">
        No scenes yet. Run <span class="font-medium text-gray-800">Generate scenes from screenplay</span> above (after director analysis), or add a scene manually.
      </div>

      <div
        class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mt-6 shadow-sm"
      >
        <h2 class="text-base font-semibold text-gray-900 mb-1">Add a scene</h2>
        <p class="text-sm text-gray-600 mb-4">
          You don’t need a script — give each beat a title and a short description. They appear in order above and on Storyboard.
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
  shotCount?: number
}

type SceneCharacterSuggestion = {
  name: string
  roleDescription: string
  screenSharePercent: number | null
}

type SceneAnalyzeResult = {
  shotCount: number
  shotsPersisted: boolean
  warning: string
  newCharacters: SceneCharacterSuggestion[]
  castInScene: string[]
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
const savedScriptBody = ref('')
const detailLoading = ref(false)
const detailError = ref<string | null>(null)
const savingScript = ref(false)

const analyzingSceneId = ref<string | null>(null)
const analyzeResultBySceneId = ref<Record<string, SceneAnalyzeResult>>({})
const analyzeErrorBySceneId = ref<Record<string, string>>({})
const addingCharacterName = ref<string | null>(null)

const scriptDirty = computed(
  () => expandedId.value != null && detailBody.value !== savedScriptBody.value
)

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
    savedScriptBody.value = ''
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
    if (scriptDirty.value && !globalThis.confirm('Discard unsaved script edits?')) return
    expandedId.value = null
    detailBody.value = ''
    savedScriptBody.value = ''
    detailError.value = null
    return
  }
  if (
    scriptDirty.value &&
    expandedId.value &&
    !globalThis.confirm('Discard unsaved script edits?')
  ) {
    return
  }
  expandedId.value = id
  detailBody.value = ''
  savedScriptBody.value = ''
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
    const body = res.scene?.body || ''
    detailBody.value = body
    savedScriptBody.value = body
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

async function saveSceneScript (sceneId: string) {
  if (!scriptDirty.value || savingScript.value) return
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Please sign in again.', 'error')
    return
  }
  savingScript.value = true
  try {
    const res = await $fetch<{ scene: { body: string; bodyLength?: number } }>(
      `/api/projects/${projectId.value}/scenes/${sceneId}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: { body: detailBody.value }
      }
    )
    const body = res.scene?.body ?? detailBody.value
    detailBody.value = body
    savedScriptBody.value = body
    const row = scenes.value.find(s => s.id === sceneId)
    if (row && typeof res.scene?.bodyLength === 'number') {
      row.bodyLength = res.scene.bodyLength
    }
    toast.showToast('Scene script saved.', 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not save scene script'), 'error')
  } finally {
    savingScript.value = false
  }
}

function revertSceneScript () {
  detailBody.value = savedScriptBody.value
}

function sceneHasSavedScript (s: SceneListRow): boolean {
  if (expandedId.value === s.id) {
    return Boolean(savedScriptBody.value.trim() || s.summary.trim())
  }
  return Boolean((s.bodyLength || 0) > 0 || s.summary.trim())
}

function canAnalyzeScene (s: SceneListRow): boolean {
  return sceneHasSavedScript(s) && !scriptDirty.value
}

function analyzeDisabledReason (s: SceneListRow): string {
  if (scriptDirty.value) return 'Save script changes first'
  if (!sceneHasSavedScript(s)) return 'Add and save script text for this scene first'
  return ''
}

async function analyzeScene (sceneId: string) {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token || analyzingSceneId.value) return
  analyzingSceneId.value = sceneId
  analyzeErrorBySceneId.value = { ...analyzeErrorBySceneId.value, [sceneId]: '' }
  try {
    const res = await $fetch<SceneAnalyzeResult & { ok?: boolean }>(
      `/api/projects/${id}/scenes/${sceneId}/analyze`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {},
        timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
      }
    )
    analyzeResultBySceneId.value = {
      ...analyzeResultBySceneId.value,
      [sceneId]: {
        shotCount: res.shotCount,
        shotsPersisted: res.shotsPersisted,
        warning: res.warning || '',
        newCharacters: res.newCharacters || [],
        castInScene: res.castInScene || []
      }
    }
    const row = scenes.value.find(s => s.id === sceneId)
    if (row) row.shotCount = res.shotCount
    const newCount = res.newCharacters?.length || 0
    if (newCount > 0) {
      toast.showToast(
        `Built ${res.shotCount} panel${res.shotCount === 1 ? '' : 's'} · ${newCount} new character${newCount === 1 ? '' : 's'} found`,
        'success'
      )
    } else {
      toast.showToast(
        `Built ${res.shotCount} storyboard panel${res.shotCount === 1 ? '' : 's'}.`,
        'success'
      )
    }
    await loadScenes()
  } catch (e: unknown) {
    const msg = formatApiFetchError(e, 'Could not analyze scene')
    analyzeErrorBySceneId.value = { ...analyzeErrorBySceneId.value, [sceneId]: msg }
    toast.showToast(msg, 'error')
  } finally {
    analyzingSceneId.value = null
  }
}

async function addSuggestedCharacter (c: SceneCharacterSuggestion) {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token) return
  addingCharacterName.value = c.name
  try {
    await $fetch(`/api/projects/${id}/characters`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: c.name,
        roleDescription: c.roleDescription,
        screenSharePercent: c.screenSharePercent
      }
    })
    toast.showToast(`${c.name} added to cast.`, 'success')
    const sceneId = expandedId.value
    if (sceneId && analyzeResultBySceneId.value[sceneId]) {
      const result = analyzeResultBySceneId.value[sceneId]
      analyzeResultBySceneId.value = {
        ...analyzeResultBySceneId.value,
        [sceneId]: {
          ...result,
          newCharacters: result.newCharacters.filter(row => row.name !== c.name)
        }
      }
    }
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not add character'), 'error')
  } finally {
    addingCharacterName.value = null
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
