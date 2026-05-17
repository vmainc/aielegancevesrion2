<template>
  <div class="max-w-6xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
      · Rendering and assembly (structure only for now).
    </p>

    <div class="rounded-xl border border-gray-200 bg-gray-50 p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Video pipeline</h2>
      <p class="text-sm text-gray-600 mb-6">
        Shot and scene renders will enqueue from storyboard frames. Project:
        <span class="text-gray-800 font-medium">{{ project?.name }}</span>
        ({{ project?.aspectRatio }}).
      </p>
      <div class="mb-5">
        <label for="video-model" class="block text-sm font-medium text-gray-700 mb-1.5">
          OpenRouter video model
        </label>
        <select
          id="video-model"
          v-model="selectedModelId"
          class="w-full sm:max-w-xl px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
          :disabled="modelsPending || !videoModels.length"
        >
          <option v-if="modelsPending" value="">
            Loading models…
          </option>
          <option v-else-if="!videoModels.length" value="">
            No models loaded
          </option>
          <option
            v-for="m in videoModels"
            :key="m.id"
            :value="m.id"
          >
            {{ m.name }} ({{ m.id }}){{ videoModelAudioSuffix(m) }}
          </option>
        </select>
        <p class="mt-2 text-xs text-gray-500">
          <span class="font-medium text-gray-700">Audio:</span>
          labels come from OpenRouter’s video catalog (<code class="text-[11px]">generate_audio</code>).
          “No audio” means the provider does not synthesize a soundtrack in this API (video-only).
        </p>
        <p v-if="modelsNotice" class="mt-1 text-xs text-gray-500">
          {{ modelsNotice }}
        </p>
        <p v-else-if="modelsError" class="mt-2 text-xs text-red-600">
          {{ modelsError }}
        </p>
      </div>
      <div class="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          class="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors text-left"
          @click="runPlaceholder('Render Shot', selectedModelId)"
        >
          Render Shot
        </button>
        <button
          type="button"
          class="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors text-left"
          @click="runPlaceholder('Render Scene', selectedModelId)"
        >
          Render Scene
        </button>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-8">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">
            Storyboard → video
          </h2>
          <p class="text-sm text-gray-600 mt-1 max-w-3xl">
            Each panel is a shot from your storyboard: title, saved frame (if any), the prompt we’ll send to the video model, then
            <span class="font-medium text-gray-800">Generate video</span>.
            Clips are planned as <span class="font-medium text-gray-800">5s or 10s</span> per shot; if the model only allows certain lengths (e.g. 6s), the server picks the closest match.
            Generated clips are saved to this project automatically and appear under
            <NuxtLink to="/assets/video" class="text-primary font-medium hover:underline">Assets → Video</NuxtLink>.
          </p>
          <label class="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              v-model="addToTimelineOnSave"
              type="checkbox"
              class="rounded border-gray-300 text-primary focus:ring-primary"
            >
            Add each new clip to this project’s timeline
          </label>
        </div>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 disabled:opacity-50"
          :disabled="boardsLoading || !canLoadBoards"
          @click="reloadStoryboardBoards"
        >
          Refresh boards
        </button>
      </div>

      <div
        v-if="!clientReady"
        class="rounded-xl border border-primary/20 bg-primary/5 px-6 py-10"
      >
        <FilmReelLoader
          size="md"
          label="Loading video workspace"
          sub-label="Preparing storyboard previews…"
        />
      </div>

      <div
        v-else-if="project?.source !== 'pocketbase'"
        class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
      >
        Storyboard previews are available for cloud projects. Open a PocketBase-backed project from
        <NuxtLink to="/projects" class="underline font-medium text-primary">Projects</NuxtLink>.
      </div>

      <div
        v-else-if="!isAuthenticated"
        class="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700"
      >
        <NuxtLink to="/login" class="text-primary font-medium underline">Log in</NuxtLink>
        to load scenes and storyboard frames.
      </div>

      <div
        v-else-if="boardsError"
        class="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
      >
        {{ boardsError }}
      </div>

      <div
        v-else-if="!scenes.length"
        class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-sm text-gray-600"
      >
        No scenes yet — generate scenes on the Scenes step, then generate frames on Storyboard. Once frames exist, they’ll show here automatically.
      </div>

      <div v-else class="space-y-8">
        <section
          v-for="(scene, sIdx) in scenes"
          :key="scene.id"
          class="rounded-xl border border-gray-200 bg-gray-50/60 overflow-hidden"
        >
          <div class="px-4 sm:px-5 py-4 border-b border-gray-200 bg-white/80">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="text-sm font-semibold text-gray-900">
                SCENE {{ sIdx + 1 }} — {{ scene.heading }}
              </h3>
              <p class="text-xs text-gray-500">
                {{ sceneShotsBySceneId[scene.id]?.length || 0 }} panel{{ (sceneShotsBySceneId[scene.id]?.length || 0) === 1 ? '' : 's' }}
              </p>
            </div>
            <p v-if="scene.summary" class="mt-2 text-xs text-gray-500 line-clamp-2">
              {{ scene.summary }}
            </p>
          </div>

          <div v-if="sceneShotsLoading[scene.id]" class="p-5">
            <FilmReelLoader
              size="sm"
              label="Loading storyboard panels"
              sub-label="Fetching shots for this scene…"
            />
          </div>

          <div v-else-if="!(sceneShotsBySceneId[scene.id] || []).length" class="px-4 sm:px-5 py-6 text-sm text-gray-600">
            No shots for this scene yet. Open
            <NuxtLink :to="`/projects/${projectId}/storyboard`" class="text-primary font-medium hover:underline">Storyboard</NuxtLink>
            and click <span class="font-medium text-gray-800">Generate Shots</span> for this scene.
          </div>

          <ul
            v-else
            class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 sm:p-5"
          >
            <li
              v-for="(shot, idx) in sceneShotsBySceneId[scene.id] || []"
              :key="shot.id"
              class="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col"
            >
              <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2 bg-gray-50 shrink-0">
                <span class="text-xs font-mono text-primary">PANEL {{ idx + 1 }}</span>
                <span class="text-xs text-gray-500 truncate">{{ shot.shotType || 'Shot' }}</span>
              </div>

              <div class="p-4 space-y-3 grow flex flex-col">
                <p class="text-sm font-semibold text-gray-900 leading-snug">
                  {{ shot.title || `Shot ${idx + 1}` }}
                </p>

                <div
                  class="rounded-lg border border-gray-200 overflow-hidden bg-gray-100 aspect-video flex items-center justify-center relative"
                >
                  <video
                    v-if="videoPreviewByKey[genKey(scene.id, shot.id)]"
                    :key="videoPreviewByKey[genKey(scene.id, shot.id)]"
                    :src="playbackVideoSrc(videoPreviewByKey[genKey(scene.id, shot.id)])"
                    class="w-full h-full object-cover"
                    controls
                    playsinline
                  />
                  <img
                    v-else-if="startFramePreviewUrl(scene.id, shot.id)"
                    :src="startFramePreviewUrl(scene.id, shot.id)!"
                    alt=""
                    class="w-full h-full object-cover"
                    loading="lazy"
                  >
                  <span v-else class="text-xs text-gray-500 px-4 text-center">
                    No storyboard frame — upload or generate a starting image below
                  </span>
                </div>
                <VideoStartFramePicker
                  :frame-image-url="customFrameByKey[genKey(scene.id, shot.id)] ?? null"
                  :prompt="finalVideoPrompt(shot, scene)"
                  compact
                  @update:frame-image-url="(v) => setCustomStartFrame(genKey(scene.id, shot.id), v)"
                />
                <div
                  v-if="videoPreviewByKey[genKey(scene.id, shot.id)]"
                  class="flex flex-wrap gap-2"
                >
                  <button
                    type="button"
                    class="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                    @click="openExpandedVideo(scene.id, shot, videoPreviewByKey[genKey(scene.id, shot.id)])"
                  >
                    Expand
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 text-xs font-medium rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                    @click="addClipToTimeline(scene, shot, videoPreviewByKey[genKey(scene.id, shot.id)])"
                  >
                    Add to timeline
                  </button>
                </div>

                <div class="grow">
                  <label class="block text-[11px] font-medium text-gray-500 mb-1">Final prompt</label>
                  <p class="text-[10px] text-gray-500 mb-1 leading-snug">
                    Includes director, scene, full cast bible, and this panel’s action (sent to the video model).
                  </p>
                  <pre class="text-xs text-gray-800 whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 max-h-52 overflow-y-auto">{{ finalVideoPrompt(shot, scene) }}</pre>
                </div>

                <button
                  type="button"
                  class="mt-auto px-3 py-2 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-gray-950 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                  :disabled="!finalVideoPrompt(shot, scene).trim() || !selectedModelId || videoGenKey === genKey(scene.id, shot.id)"
                  @click="generateVideoForPanel(shot, scene.id)"
                >
                  {{ videoGenKey === genKey(scene.id, shot.id) ? 'Generating…' : 'Generate video' }}
                </button>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Timeline editor</h2>
      <p class="text-sm text-gray-600 mb-4">
        Drag clips on a two-track layout (video + audio), reorder shots, and preview the sequence in order.
      </p>
      <NuxtLink
        :to="`/projects/${projectId}/timeline`"
        class="inline-flex px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors"
      >
        Open timeline
      </NuxtLink>
    </div>

    <Teleport to="body">
      <div
        v-if="expandedVideo"
        class="fixed inset-0 z-[100] bg-black/92 flex flex-col p-3 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Video preview"
        @click.self="expandedVideo = null"
      >
        <div class="max-w-7xl w-full mx-auto flex flex-col flex-1 min-h-0">
          <div class="flex justify-between items-center gap-3 mb-3 text-white shrink-0">
            <p class="text-sm font-medium truncate">
              {{ expandedVideo.title }}
            </p>
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 border border-white/20"
              @click="expandedVideo = null"
            >
              Close
            </button>
          </div>
          <video
            :src="playbackVideoSrc(expandedVideo.url)"
            class="w-full flex-1 min-h-[40vh] max-h-[calc(100vh-5rem)] rounded-lg bg-black object-contain"
            controls
            autoplay
            playsinline
          />
        </div>
      </div>
    </Teleport>

    <div class="pt-8 border-t border-gray-200 flex flex-wrap gap-4">
      <NuxtLink
        :to="`/projects/${projectId}/timeline`"
        class="text-sm text-primary font-medium hover:underline"
      >
        Open Timeline →
      </NuxtLink>
      <NuxtLink
        to="/tools/script-wizard"
        class="text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        Script Wizard
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import {
  appendPlaybackAccessToken,
  projectAssetMediaPath
} from '~/lib/project-asset-playback-url'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import {
  buildFullVideoGenerationPrompt,
  findCharactersInShot,
  pickPrimaryCharacterPortrait,
  type ProductionPromptContext
} from '~/lib/shot-character-continuity'
import {
  generateOpenRouterVideo,
  playbackUrlForProjectVideoAsset,
  saveVideoToProjectLibrary
} from '~/composables/useOpenRouterVideoGen'
import type { CreativeShot } from '~/types/creative-shot'
import type { ProjectAsset } from '~/types/project-asset'

const { activeProject, activeProjectId, clientReady } = useCreativeProject()
const { isAuthenticated, getAuthToken } = useAuth()
const authTokenState = useState<string | null>('auth_token')
const { stepBadge } = useProjectWorkflowStep()
const toast = useToast()

const PB_ID = /^[a-z0-9]{15}$/

type VideoModel = {
  id: string
  name: string
  description?: string
  supportedDurations?: number[]
  /** From OpenRouter video catalog when known. */
  generateAudio?: boolean
}
type VideoModelsPayload = {
  models?: VideoModel[]
  notice?: string
}

const project = activeProject
const projectId = activeProjectId

const { data: videoModelsData, pending: modelsPending, error: modelsFetchError } = await useFetch<VideoModelsPayload>('/api/openrouter/video-models')
const videoModels = computed(() => videoModelsData.value?.models || [])
const selectedModelId = ref('')
const modelsNotice = computed(() => videoModelsData.value?.notice || '')
const modelsError = computed(() => (modelsFetchError.value ? 'Could not load OpenRouter models right now.' : ''))

type SceneRow = {
  id: string
  sortOrder: number
  heading: string
  summary: string
  bodyLength: number
  shotCount?: number
}

const scenes = ref<SceneRow[]>([])
const addToTimelineOnSave = ref(false)
const boardsError = ref('')
const boardsLoading = ref(false)
const storyboardAssets = ref<ProjectAsset[]>([])
const sceneShotsBySceneId = reactive<Record<string, CreativeShot[]>>({})
const sceneShotsLoading = reactive<Record<string, boolean>>({})
const videoGenKey = ref('')
const videoPreviewByKey = reactive<Record<string, string>>({})
const customFrameByKey = reactive<Record<string, string>>({})
const expandedVideo = ref<{ url: string; title: string } | null>(null)

const { addVideoClip } = useProjectTimeline(projectId)
const { refs: characterRefs } = useProjectCharacterRefs(projectId)

const canLoadBoards = computed(
  () => !!project.value && project.value.source === 'pocketbase' && PB_ID.test(projectId.value) && isAuthenticated.value
)

watch(videoModels, (rows) => {
  if (!rows.length) return
  if (!selectedModelId.value || !rows.some(r => r.id === selectedModelId.value)) {
    selectedModelId.value = rows[0].id
  }
}, { immediate: true })

function videoModelAudioSuffix (m: VideoModel): string {
  if (m.generateAudio === true) return ' · audio'
  if (m.generateAudio === false) return ' · no audio'
  return ''
}

function runPlaceholder (label: string, modelId?: string) {
  const suffix = modelId ? ` (model: ${modelId})` : ''
  toast.showToast(`${label} is not wired yet — coming soon.${suffix}`, 'info')
}

function authHeaders () {
  const token = getAuthToken()
  if (!token) return null
  return { Authorization: `Bearer ${token}` }
}

async function loadScenesForVideo () {
  boardsError.value = ''
  scenes.value = []
  if (!canLoadBoards.value) return
  const id = projectId.value
  const headers = authHeaders()
  if (!headers) return
  boardsLoading.value = true
  try {
    const res = await $fetch<{ scenes: SceneRow[] }>(`/api/projects/${id}/scenes`, { headers })
    scenes.value = res.scenes || []
  } catch (e: unknown) {
    scenes.value = []
    boardsError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load scenes.')
        : 'Could not load scenes.'
  } finally {
    boardsLoading.value = false
  }
}

async function loadStoryboardAssetsForVideo () {
  storyboardAssets.value = []
  if (!canLoadBoards.value) return
  const id = projectId.value
  const headers = authHeaders()
  if (!headers) return
  try {
    const res = await $fetch<{ items: ProjectAsset[] }>(`/api/projects/${id}/assets?kind=storyboard`, { headers })
    storyboardAssets.value = res.items || []
  } catch {
    storyboardAssets.value = []
  }
}

async function loadShotsForScene (sceneId: string) {
  if (!canLoadBoards.value || !sceneId) return
  const id = projectId.value
  const headers = authHeaders()
  if (!headers) return
  sceneShotsLoading[sceneId] = true
  try {
    const res = await $fetch<{ shots: CreativeShot[] }>(`/api/projects/${id}/scenes/${sceneId}/shots`, { headers })
    sceneShotsBySceneId[sceneId] = res.shots || []
  } catch {
    sceneShotsBySceneId[sceneId] = []
  } finally {
    sceneShotsLoading[sceneId] = false
  }
}

async function loadVideoAssetsForPanels () {
  if (!canLoadBoards.value) return
  const id = projectId.value
  const headers = authHeaders()
  if (!headers) return
  try {
    const res = await $fetch<{ items: ProjectAsset[] }>(`/api/projects/${id}/assets?kind=video`, { headers })
    for (const a of res.items || []) {
      const meta = a.metadata
      if (!meta || typeof meta !== 'object') continue
      const sceneId = typeof meta.scene_id === 'string' ? meta.scene_id : ''
      const shotId = typeof meta.shot_id === 'string' ? meta.shot_id : ''
      if (!sceneId || !shotId || !a.id) continue
      videoPreviewByKey[genKey(sceneId, shotId)] = projectAssetMediaPath(id, a.id)
    }
  } catch {
    // non-fatal
  }
}

async function reloadStoryboardBoards () {
  await loadScenesForVideo()
  await loadStoryboardAssetsForVideo()
  await loadVideoAssetsForPanels()
  await Promise.all(scenes.value.map(s => loadShotsForScene(s.id)))
}

function frameUrlFor (sceneId: string, shotId: string): string | null {
  const hit = storyboardAssets.value.find((a) => {
    const meta = a.metadata || {}
    return (
      a.fileUrl &&
      typeof meta.scene_id === 'string' &&
      typeof meta.shot_id === 'string' &&
      meta.scene_id === sceneId &&
      meta.shot_id === shotId
    )
  })
  return hit?.fileUrl || null
}

function setCustomStartFrame (key: string, url: string | null) {
  if (url) customFrameByKey[key] = url
  else delete customFrameByKey[key]
}

function startFramePreviewUrl (sceneId: string, shotId: string): string | null {
  const key = genKey(sceneId, shotId)
  const custom = customFrameByKey[key]
  if (custom) return custom
  return frameUrlFor(sceneId, shotId)
}

function resolveStartFrameForApi (
  sceneId: string,
  shotId: string,
  castMatches: ReturnType<typeof findCharactersInShot>
): string {
  const key = genKey(sceneId, shotId)
  const custom = customFrameByKey[key]
  if (custom) return custom
  return frameUrlFor(sceneId, shotId) || pickPrimaryCharacterPortrait(castMatches) || ''
}

function productionPromptContext (
  shot: CreativeShot,
  scene?: SceneRow
): ProductionPromptContext {
  return {
    director: project.value?.director,
    continuityMemory: project.value?.continuityMemory,
    scene: scene
      ? { heading: scene.heading, summary: scene.summary }
      : undefined,
    shot,
    cast: characterRefs.value
  }
}

function finalVideoPrompt (shot: CreativeShot, scene?: SceneRow): string {
  return buildFullVideoGenerationPrompt(productionPromptContext(shot, scene))
}

function genKey (sceneId: string, shotId: string) {
  return `${sceneId}:${shotId}`
}

function playbackVideoSrc (raw: string | undefined): string {
  void authTokenState.value
  const u = (raw || '').trim()
  if (!u) return ''
  return appendPlaybackAccessToken(u, getAuthToken())
}

function openExpandedVideo (sceneId: string, shot: CreativeShot, url: string) {
  const u = url.trim()
  if (!u) return
  expandedVideo.value = {
    url: u,
    title: `${shot.title || 'Shot'} · panel`
  }
}

function addClipToTimeline (scene: SceneRow, shot: CreativeShot, url: string) {
  const u = url.trim()
  if (!u) return
  addVideoClip({
    url: u,
    label: `${shot.title || 'Clip'} — ${scene.heading || 'Scene'}`.slice(0, 500),
    sceneId: scene.id,
    shotId: shot.id
  })
  toast.showToast('Clip added to timeline.', 'success')
}

async function generateVideoForPanel (shot: CreativeShot, sceneId: string) {
  const scene = scenes.value.find(s => s.id === sceneId)
  const prompt = finalVideoPrompt(shot, scene).trim()
  if (!prompt) {
    toast.showToast('This panel has no prompt yet.', 'info')
    return
  }
  if (!selectedModelId.value) {
    toast.showToast('Pick a video model first.', 'info')
    return
  }
  const castMatches = findCharactersInShot(shot, characterRefs.value, scene?.summary)
  videoGenKey.value = genKey(sceneId, shot.id)
  try {
    const aspect =
      project.value?.aspectRatio === '9:16'
        ? '9:16'
        : project.value?.aspectRatio === '1:1'
          ? '1:1'
          : '16:9'
    const frame = resolveStartFrameForApi(sceneId, shot.id, castMatches)
    const baseSec = snapToStoryboardClipSeconds(Number(shot.durationSeconds) || 5)
    const modelRow = videoModels.value.find(m => m.id === selectedModelId.value)
    const headers = authHeaders()
    toast.showToast('Rendering… you can leave this page; come back to refresh.', 'info')
    const { videoUrl: url } = await generateOpenRouterVideo({
      prompt,
      model: selectedModelId.value,
      aspectRatio: aspect,
      resolution: '720p',
      durationSeconds: baseSec,
      frameImageUrl: frame || undefined,
      supportedDurations: modelRow?.supportedDurations
    })
    const key = genKey(sceneId, shot.id)
    videoPreviewByKey[key] = url

    let playbackUrl = url
    if (headers) {
      const asset = await saveVideoToProjectLibrary({
        projectId: projectId.value,
        remoteUrl: url,
        title: `${shot.title || 'Shot'} — video`.slice(0, 500),
        notes: 'Generated from this project’s Video step (saved for playback in your library).',
        metadata: {
          scene_id: sceneId,
          shot_id: shot.id,
          model_id: selectedModelId.value,
          source: 'openrouter_video',
          character_ids: castMatches.map(c => c.id),
          character_names: castMatches.map(c => c.name)
        },
        headers
      })
      if (asset?.id) {
        playbackUrl = playbackUrlForProjectVideoAsset(projectId.value, asset.id)
        videoPreviewByKey[key] = playbackUrl
        toast.showToast('Video saved — playable from your project and under Assets → Video.', 'success')
      } else {
        toast.showToast(
          'Video render finished, but saving to your library failed. Try again or check server logs.',
          'warning'
        )
      }
    }

    if (addToTimelineOnSave.value && playbackUrl) {
      addClipToTimeline(
        scene || { id: sceneId, heading: 'Scene', sortOrder: 0, summary: '', bodyLength: 0 },
        shot,
        playbackVideoSrc(playbackUrl)
      )
    }
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Video generation failed'), 'error')
  } finally {
    videoGenKey.value = ''
  }
}

watch(
  () => ({
    ok: canLoadBoards.value,
    pid: projectId.value,
    ready: clientReady.value
  }),
  (cur) => {
    if (!cur.ok || !cur.ready) {
      scenes.value = []
      storyboardAssets.value = []
      for (const k of Object.keys(sceneShotsBySceneId)) delete sceneShotsBySceneId[k]
      return
    }
    void reloadStoryboardBoards()
  },
  { immediate: true }
)
</script>
