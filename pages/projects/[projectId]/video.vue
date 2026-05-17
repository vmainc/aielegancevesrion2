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
          </p>
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
                    v-else-if="frameUrlFor(scene.id, shot.id)"
                    :src="frameUrlFor(scene.id, shot.id)!"
                    alt=""
                    class="w-full h-full object-cover"
                    loading="lazy"
                  >
                  <span v-else class="text-xs text-gray-500 px-4 text-center">
                    No saved storyboard frame yet
                  </span>
                </div>
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
                  <pre class="text-xs text-gray-800 whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 max-h-40 overflow-y-auto">{{ finalVideoPrompt(shot) }}</pre>
                </div>

                <button
                  type="button"
                  class="mt-auto px-3 py-2 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-gray-950 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                  :disabled="!finalVideoPrompt(shot).trim() || !selectedModelId || videoGenKey === genKey(scene.id, shot.id)"
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
import { snapDurationToModelSupported, snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
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

type VideoJobPostResponse = {
  async?: boolean
  jobId?: string
  status?: string
  model?: string
  videoUrl?: string
}

const scenes = ref<SceneRow[]>([])
const boardsError = ref('')
const boardsLoading = ref(false)
const storyboardAssets = ref<ProjectAsset[]>([])
const sceneShotsBySceneId = reactive<Record<string, CreativeShot[]>>({})
const sceneShotsLoading = reactive<Record<string, boolean>>({})
const videoGenKey = ref('')
const videoPreviewByKey = reactive<Record<string, string>>({})
const expandedVideo = ref<{ url: string; title: string } | null>(null)

const { addVideoClip } = useProjectTimeline(projectId)

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

async function reloadStoryboardBoards () {
  await loadScenesForVideo()
  await loadStoryboardAssetsForVideo()
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

function finalVideoPrompt (shot: CreativeShot): string {
  const v = (shot.videoPrompt || '').trim()
  if (v) return v
  const i = (shot.imagePrompt || '').trim()
  if (i) return i
  return (shot.description || '').trim()
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

async function persistGeneratedVideoToLibrary (args: {
  projectId: string
  sceneId: string
  shot: CreativeShot
  remoteUrl: string
  modelId: string
}): Promise<ProjectAsset | null> {
  const headers = authHeaders()
  if (!headers) return null
  const title = `${args.shot.title || 'Shot'} — video`.slice(0, 500)
  try {
    const res = await $fetch<{ asset?: ProjectAsset }>(
      `/api/projects/${args.projectId}/assets/ingest-from-url`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: {
          url: args.remoteUrl,
          kind: 'video',
          title,
          notes: 'Generated from this project’s Video step (saved for playback in your library).',
          metadata: {
            scene_id: args.sceneId,
            shot_id: args.shot.id,
            model_id: args.modelId,
            source: 'openrouter_video'
          }
        }
      }
    )
    return res.asset ?? null
  } catch (e: unknown) {
    console.warn('[video] library ingest failed:', formatApiFetchError(e, 'ingest'))
    return null
  }
}

async function pollVideoJobUntilDone (jobId: string): Promise<string> {
  const deadline = Date.now() + 22 * 60 * 1000
  let wait = 2200
  while (Date.now() < deadline) {
    const s = await $fetch<{
      jobId: string
      status: string
      videoUrl?: string
      message?: string
    }>('/api/generate/video/status', { query: { jobId } })
    if (s.status === 'completed' && s.videoUrl?.trim()) {
      return s.videoUrl.trim()
    }
    if (s.status === 'failed' || s.status === 'cancelled' || s.status === 'expired') {
      throw new Error((s.message || '').trim() || `Video job ${s.status}`)
    }
    await new Promise(r => setTimeout(r, wait))
    wait = Math.min(14_000, Math.floor(wait * 1.22))
  }
  throw new Error('Still rendering — try again in a bit or check OpenRouter.')
}

async function generateVideoForPanel (shot: CreativeShot, sceneId: string) {
  const prompt = finalVideoPrompt(shot).trim()
  if (!prompt) {
    toast.showToast('This panel has no prompt yet.', 'info')
    return
  }
  if (!selectedModelId.value) {
    toast.showToast('Pick a video model first.', 'info')
    return
  }
  videoGenKey.value = genKey(sceneId, shot.id)
  try {
    const aspect =
      project.value?.aspectRatio === '9:16'
        ? '9:16'
        : project.value?.aspectRatio === '1:1'
          ? '1:1'
          : '16:9'
    const frame = frameUrlFor(sceneId, shot.id) || ''
    const baseSec = snapToStoryboardClipSeconds(Number(shot.durationSeconds) || 5)
    const modelRow = videoModels.value.find(m => m.id === selectedModelId.value)
    const supported = modelRow?.supportedDurations
    const durationSeconds =
      supported?.length ? snapDurationToModelSupported(baseSec, supported) : baseSec
    const res = await $fetch<VideoJobPostResponse>('/api/generate/video', {
      method: 'POST',
      body: {
        prompt,
        model: selectedModelId.value,
        aspectRatio: aspect,
        resolution: '720p',
        durationSeconds,
        frameImageUrl: frame || undefined
      }
    })
    let url = typeof res?.videoUrl === 'string' ? res.videoUrl.trim() : ''
    if (!url && res?.async && res.jobId) {
      toast.showToast('Rendering… you can leave this page; come back to refresh.', 'info')
      url = await pollVideoJobUntilDone(res.jobId)
    }
    if (!url) {
      toast.showToast('Video generation finished but no URL was returned.', 'warning')
      return
    }
    const key = genKey(sceneId, shot.id)
    videoPreviewByKey[key] = url

    const asset = await persistGeneratedVideoToLibrary({
      projectId: projectId.value,
      sceneId,
      shot,
      remoteUrl: url,
      modelId: selectedModelId.value
    })
    if (asset?.id) {
      videoPreviewByKey[key] = projectAssetMediaPath(projectId.value, asset.id)
      toast.showToast('Video saved — playable from your project and under Assets → Video.', 'success')
    } else {
      toast.showToast(
        'Video render finished, but saving to your library failed (OpenRouter URLs often need auth to play in-browser). Try again or check server logs.',
        'warning'
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
