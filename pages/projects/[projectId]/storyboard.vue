<template>
  <div :class="isFullscreen ? 'fixed inset-0 z-40 bg-white overflow-y-auto p-4 sm:p-6' : 'max-w-4xl'">
    <div class="flex items-start justify-between gap-3 mb-6">
      <p class="text-sm text-gray-500">
        <span class="text-primary font-medium">Storyboard</span>
      · Pick a scene and use
      <span class="text-gray-700">Generate Shots</span>
      for a continuity-aware refresh. Then
      <span class="text-gray-700">Generate frame</span>
      — we attach your cast’s featured portraits and visual prompts so panels match Character Creator.
      </p>
      <button
        type="button"
        class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
        @click="isFullscreen = !isFullscreen"
      >
        {{ isFullscreen ? 'Exit fullscreen' : 'Fullscreen' }}
      </button>
    </div>

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
                  SCENE {{ idx + 1 }} — {{ s.heading }} ({{ scenePanelLabel(s) }})
                </option>
              </select>
              <p v-if="activeScene?.summary" class="mt-2 text-xs text-gray-500 line-clamp-2">
                {{ activeScene.summary }}
              </p>
              <p class="mt-1 text-xs text-gray-500">
                <template v-if="activeSceneShotCount > 0">
                  {{ activeSceneShotCount }} panel skeleton{{ activeSceneShotCount === 1 ? '' : 's' }} currently in this scene.
                </template>
                <template v-else>
                  Estimated output: 5-12 panels for this scene.
                </template>
              </p>
            </div>
            <div class="shrink-0 flex items-center gap-2">
              <div class="relative">
                <button
                  type="button"
                  class="h-10 w-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                  :aria-expanded="showImageSettings ? 'true' : 'false'"
                  aria-label="Image settings"
                  @click="showImageSettings = !showImageSettings"
                >
                  ⚙
                </button>
                <div
                  v-if="showImageSettings"
                  class="absolute right-0 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg z-20"
                >
                  <label for="image-model-pick" class="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                    Image model
                  </label>
                  <select
                    id="image-model-pick"
                    v-model="selectedImageModelId"
                    class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
                  >
                    <option v-for="m in imageModelOptions" :key="m.id" :value="m.id">
                      {{ m.label }}
                    </option>
                  </select>
                  <p class="mt-2 text-xs text-gray-500">
                    Generated frames auto-save to this project. Named characters use their featured portrait from Assets → Characters when available.
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                :disabled="generating || !selectedSceneId"
                @click="generateShots"
              >
                {{ generating ? 'Generating cinematic shots…' : 'Generate Shots' }}
              </button>
            </div>
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

        <div
          v-if="!shotsLoading && !generating && persistenceWarning"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {{ persistenceWarning }}
        </div>

        <ul v-if="!shotsLoading && shots.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <li
            v-for="(shot, idx) in shots"
            :key="shot.id"
            class="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex flex-col"
          >
            <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2 bg-gray-50 shrink-0">
              <span class="text-xs font-mono text-primary">BOARD {{ idx + 1 }}</span>
              <span class="text-xs text-gray-500 truncate">{{ shot.shotType || 'Shot' }} · {{ shot.durationSeconds }}s</span>
            </div>
            <div class="p-4 pt-3 sm:p-5 space-y-3 grow">
              <div
                v-if="framePreview[shot.id]"
                class="rounded-lg border border-gray-200 overflow-hidden bg-gray-100"
              >
                <img
                  :src="framePreview[shot.id]"
                  alt=""
                  class="w-full aspect-video object-cover"
                >
              </div>
              <div
                v-else
                class="rounded-lg border border-dashed border-gray-300 bg-white text-xs text-gray-500 px-3 py-8 text-center"
              >
                No frame yet
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Board title</label>
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
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block text-[11px] font-medium text-gray-500 mb-1">Type</label>
                  <input
                    v-model="shot.shotType"
                    type="text"
                    class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                  >
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-gray-500 mb-1">Camera</label>
                  <input
                    v-model="shot.cameraMove"
                    type="text"
                    class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                  >
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-gray-500 mb-1">Clip (video)</label>
                  <select
                    v-model.number="shot.durationSeconds"
                    class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                  >
                    <option :value="5">
                      5s
                    </option>
                    <option :value="10">
                      10s
                    </option>
                  </select>
                </div>
              </div>
              <div class="flex flex-col gap-1.5 pt-1">
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                    :disabled="
                      imageGenId === shot.id ||
                      !((shot.imagePrompt || shot.description || '').trim())
                    "
                    @click="generateFrame(shot)"
                  >
                    {{ imageGenId === shot.id ? 'Generating…' : `Generate image (${activeImageModelLabel})` }}
                  </button>
                </div>
                <p
                  v-if="shotCharacterMatches(shot).length"
                  class="text-[11px] text-gray-500 leading-snug"
                >
                  Cast continuity:
                  <span
                    v-for="(c, ci) in shotCharacterMatches(shot)"
                    :key="c.id"
                    class="font-medium text-gray-700"
                  >
                    {{ c.name }}<span v-if="c.portraitUrl" class="text-primary"> · ref</span><span v-if="ci < shotCharacterMatches(shot).length - 1">, </span>
                  </span>
                </p>
              </div>
              <details class="group border-t border-gray-200 pt-3">
                <summary class="cursor-pointer text-sm text-primary font-medium hover:underline">
                  Shot details & prompts
                </summary>
                <div class="mt-3 space-y-3 pt-1">
                  <div>
                    <div class="flex justify-between items-center gap-2 mb-1">
                      <label class="text-xs font-medium text-gray-500">{{ shotImagePromptLabel(shot) }}</label>
                      <PromptEnhanceButton v-model="shot.imagePrompt" context="shot_image" />
                    </div>
                    <textarea
                      v-model="shot.imagePrompt"
                      rows="3"
                      class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
                    />
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
        <NuxtLink
          :to="`/projects/${projectId}/timeline`"
          class="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          Timeline
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CreativeShot } from '~/types/creative-shot'
import type { ProjectAsset } from '~/types/project-asset'
import { CHARACTER_CREATOR_IMAGE_MODELS } from '~/lib/character-creator-models'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import {
  buildStoryboardFramePrompt,
  findCharactersInShot,
  pickPrimaryCharacterPortrait
} from '~/lib/shot-character-continuity'

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
  shotCount?: number
}

const scenes = ref<SceneRow[]>([])
const { refs: characterRefs, reload: reloadCharacterRefs } = useProjectCharacterRefs(projectId)
const storyboardAssets = ref<ProjectAsset[]>([])
const selectedSceneId = ref('')
const scenesLoadError = ref('')
const shots = ref<CreativeShot[]>([])
const shotsLoading = ref(false)
const generating = ref(false)
const generateError = ref('')
const persistenceWarning = ref('')
const shotsPersisted = ref(true)
const imageGenId = ref<string | null>(null)
const framePreview = reactive<Record<string, string>>({})
const isFullscreen = ref(false)
const showImageSettings = ref(false)
const imageModelOptions = CHARACTER_CREATOR_IMAGE_MODELS
const selectedImageModelId = ref<string>(imageModelOptions[0]?.id || 'dalle-3')
const activeImageModelLabel = computed(
  () => imageModelOptions.find(m => m.id === selectedImageModelId.value)?.label || selectedImageModelId.value
)

const activeScene = computed(() => scenes.value.find(s => s.id === selectedSceneId.value))
const activeSceneShotCount = computed(() => {
  const n = Number(activeScene.value?.shotCount || 0)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
})

function scenePanelLabel (scene: SceneRow): string {
  const existing = Number(scene.shotCount || 0)
  if (Number.isFinite(existing) && existing > 0) {
    return `${Math.floor(existing)} panel${Math.floor(existing) === 1 ? '' : 's'}`
  }
  return 'est. 5-12 panels'
}

function shotCharacterMatches (shot: CreativeShot) {
  return findCharactersInShot(shot, characterRefs.value, activeScene.value?.summary)
}

function shotImagePromptLabel (shot: CreativeShot): string {
  const matches = shotCharacterMatches(shot)
  if (matches.length === 1) return `${matches[0].name} prompt`
  if (matches.length > 1) return 'Cast prompt'
  return 'Image prompt'
}

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
  const basePrompt = (shot.imagePrompt || shot.description || '').trim()
  if (!basePrompt) {
    toast.showToast('Add an image prompt or description first.', 'info')
    return
  }
  const matches = shotCharacterMatches(shot)
  const prompt = buildStoryboardFramePrompt(basePrompt, matches, {
    director: project.value?.director,
    continuityMemory: project.value?.continuityMemory,
    scene: activeScene.value
      ? { heading: activeScene.value.heading, summary: activeScene.value.summary }
      : undefined,
    shot,
    cast: characterRefs.value
  })
  const referenceImageUrl = pickPrimaryCharacterPortrait(matches) || undefined
  imageGenId.value = shot.id
  try {
    const res = await $fetch<{ urls?: unknown[] }>('/api/generate/image', {
      method: 'POST',
      body: {
        prompt,
        model: selectedImageModelId.value,
        referenceImageUrl
      }
    })
    const url = firstImageUrl(res.urls || [])
    if (url) {
      framePreview[shot.id] = url
      const saveErr = await autoSaveGeneratedFrame(shot, url, matches)
      if (!saveErr) {
        toast.showToast('Frame generated and saved.', 'success')
      } else {
        toast.showToast(`Frame generated (save failed): ${saveErr}`, 'warning')
      }
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

function applySavedFramesForCurrentScene () {
  const sid = selectedSceneId.value
  if (!sid) return
  for (const s of shots.value) {
    const hit = storyboardAssets.value.find((a) => {
      const meta = a.metadata || {}
      return (
        a.fileUrl &&
        typeof meta.scene_id === 'string' &&
        typeof meta.shot_id === 'string' &&
        meta.scene_id === sid &&
        meta.shot_id === s.id
      )
    })
    if (hit?.fileUrl) framePreview[s.id] = hit.fileUrl
  }
}

async function loadStoryboardAssets () {
  const id = projectId.value
  if (!id || project.value?.source !== 'pocketbase') return
  const headers = await authHeaders()
  if (!headers) return
  try {
    const res = await $fetch<{ items: ProjectAsset[] }>(`/api/projects/${id}/assets?kind=storyboard`, { headers })
    storyboardAssets.value = res.items || []
  } catch {
    storyboardAssets.value = []
  }
}

async function autoSaveGeneratedFrame (
  shot: CreativeShot,
  imageUrl: string,
  matches: ReturnType<typeof shotCharacterMatches>
): Promise<string | null> {
  if (!shotsPersisted.value) return 'shots are preview-only right now'
  const id = projectId.value
  const sid = selectedSceneId.value
  if (!id || !sid) return 'missing project or scene id'
  const token = getAuthToken()
  if (!token) return 'not authenticated'
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return `could not download generated image (HTTP ${imgRes.status})`
    const blob = await imgRes.blob()
    const compressed = await maybeCompressImageBlob(blob)
    const ext = compressed.type.includes('png') ? 'png' : 'jpg'
    const fd = new FormData()
    fd.append('kind', 'storyboard')
    fd.append('title', `${shot.title || 'Storyboard Frame'} (${activeImageModelLabel.value})`)
    fd.append('notes', 'Auto-saved generated frame')
    fd.append(
      'metadata',
      JSON.stringify({
        scene_id: sid,
        shot_id: shot.id,
        model_id: selectedImageModelId.value,
        model_label: activeImageModelLabel.value,
        character_ids: matches.map(c => c.id),
        character_names: matches.map(c => c.name)
      })
    )
    fd.append('file', new File([compressed], `frame_${shot.id}.${ext}`, { type: compressed.type || 'image/jpeg' }))
    const out = await $fetch<{ asset?: ProjectAsset }>(`/api/projects/${id}/assets/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    })
    const fileUrl = out.asset?.fileUrl || ''
    if (fileUrl) {
      framePreview[shot.id] = fileUrl
      await loadStoryboardAssets()
      return null
    }
    return 'upload endpoint returned no file URL'
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'data' in e) {
      const msg = String((e as { data?: { message?: string } }).data?.message || '').trim()
      if (msg) return msg
    }
    if (e instanceof Error && e.message.trim()) return e.message.trim()
    return 'unknown upload error'
  }
}

async function maybeCompressImageBlob (blob: Blob): Promise<Blob> {
  const MAX_UPLOAD_BYTES = 900_000
  if (!blob.type.startsWith('image/')) return blob
  if (blob.size <= MAX_UPLOAD_BYTES) return blob
  const dataUrl = await blobToDataUrl(blob)
  const img = await loadImageFromDataUrl(dataUrl)
  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height
  const maxSide = 1400
  if (Math.max(width, height) > maxSide) {
    const scale = maxSide / Math.max(width, height)
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  ctx.drawImage(img, 0, 0, width, height)
  let quality = 0.86
  let out = await canvasToBlob(canvas, 'image/jpeg', quality)
  while (out && out.size > MAX_UPLOAD_BYTES && quality > 0.45) {
    quality -= 0.08
    out = await canvasToBlob(canvas, 'image/jpeg', quality)
  }
  return out || blob
}

function blobToDataUrl (blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('Could not read image data'))
    r.readAsDataURL(blob)
  })
}

function loadImageFromDataUrl (dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = dataUrl
  })
}

function canvasToBlob (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
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
  persistenceWarning.value = ''
  shotsPersisted.value = true
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
    shots.value = res.shots?.length
      ? res.shots.map(s => ({
        ...s,
        durationSeconds: snapToStoryboardClipSeconds(Number(s.durationSeconds) || 5)
      }))
      : []
    shotsPersisted.value = true
    await loadStoryboardAssets()
    applySavedFramesForCurrentScene()
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
  persistenceWarning.value = ''
  shotsPersisted.value = true
  try {
    const res = await $fetch<{
      shots: CreativeShot[]
      persisted?: boolean
      warning?: string
      continuity?: { issueCount: number; memoryUpdated: boolean }
    }>('/api/generate-shots', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: { project_id: id, scene_id: sid }
    })
    shots.value = res.shots?.length
      ? res.shots.map(s => ({
        ...s,
        durationSeconds: snapToStoryboardClipSeconds(Number(s.durationSeconds) || 5)
      }))
      : []
    shotsPersisted.value = res.persisted !== false
    if (!shotsPersisted.value) {
      persistenceWarning.value = res.warning || 'Shots are preview-only right now and were not saved.'
    }
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

watch(
  () => [clientReady.value, isAuthenticated.value, project.value?.id, project.value?.source] as const,
  () => {
    void loadScenes()
    void reloadCharacterRefs()
  },
  { immediate: true }
)

watch(selectedSceneId, () => {
  showImageSettings.value = false
  void loadShots()
})
</script>
