<template>
  <div class="max-w-6xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
      · Turn storyboard panels into clips — open Video generation per panel, compare models, then assemble on Timeline.
    </p>

    <CloudProjectRequired
      feature-label="Storyboard → video"
      loading-label="Loading video workspace"
      loading-sub-label="Preparing storyboard previews…"
    >
    <div class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-8">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">
            Storyboard → video
          </h2>
          <p class="text-sm text-gray-600 mt-1 max-w-3xl">
            Each panel uses your <span class="font-medium text-gray-800">storyboard frame</span> as the seed image.
            <span class="font-medium text-gray-800">Generate video</span> opens
            <NuxtLink to="/tools/video-generation" class="text-primary font-medium hover:underline">Video generation</NuxtLink>
            with the full production prompt and frame prefilled — pick multiple models there.
            When a clip is ready it replaces the still here (play inline or fullscreen).
            Clips are <span class="font-medium text-gray-800">5s or 10s</span> per shot; the server snaps to what the model supports.
            Generated video has <span class="font-medium text-gray-800">no AI background music</span> — add music on the
            <NuxtLink :to="`/projects/${projectId}/timeline`" class="text-primary font-medium hover:underline">timeline</NuxtLink>
            audio track.
            Saved clips appear under
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
        v-if="!isAuthenticated"
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
              :id="panelDomId(scene.id, shot.id)"
              class="rounded-xl border bg-white overflow-hidden flex flex-col transition-shadow"
              :class="highlightPanelKey === genKey(scene.id, shot.id)
                ? 'border-primary ring-2 ring-primary/35 shadow-md'
                : 'border-gray-200'"
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
                  :class="[
                    storyboardFramePreviewClasses(project?.aspectRatio),
                    'relative group bg-gray-900'
                  ]"
                >
                  <video
                    v-if="videoPreviewByKey[genKey(scene.id, shot.id)]"
                    :key="videoPreviewByKey[genKey(scene.id, shot.id)]"
                    :src="playbackVideoSrc(videoPreviewByKey[genKey(scene.id, shot.id)])"
                    class="w-full h-full object-contain"
                    controls
                    playsinline
                  />
                  <img
                    v-else-if="panelStoryboardUrl(shot, scene.id)"
                    :src="panelStoryboardUrl(shot, scene.id)!"
                    alt=""
                    class="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    loading="lazy"
                  >
                  <p
                    v-else-if="!panelStoryboardUrl(shot, scene.id)"
                    class="absolute inset-0 flex items-center justify-center text-xs text-gray-400 px-4 text-center"
                  >
                    No storyboard frame yet —
                    <NuxtLink
                      :to="`/projects/${projectId}/storyboard`"
                      class="text-primary font-medium hover:underline ml-1"
                    >Generate image</NuxtLink>
                    on Storyboard first.
                  </p>
                  <span
                    v-else-if="!panelVideoUrl(scene.id, shot.id)"
                    class="absolute bottom-2 left-2 z-10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-black/55 text-white"
                  >
                    Seed frame
                  </span>
                  <button
                    v-if="panelVideoUrl(scene.id, shot.id)"
                    type="button"
                    class="absolute top-2 right-2 z-10 px-2 py-1 text-[11px] font-semibold rounded-md bg-gray-950/75 text-white hover:bg-gray-950 border border-white/20"
                    @click="openExpandedVideo(scene.id, shot, panelVideoUrl(scene.id, shot.id)!)"
                  >
                    Fullscreen
                  </button>
                  <button
                    v-else-if="panelStoryboardUrl(shot, scene.id)"
                    type="button"
                    class="absolute inset-0 w-full h-full cursor-zoom-in rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary z-[1]"
                    :aria-label="`View seed frame: ${shot.title || 'panel'}`"
                    @click="openExpandedFrame(shot, panelStoryboardUrl(shot, scene.id)!)"
                  />
                </div>
                <div
                  v-if="panelVideoUrl(scene.id, shot.id)"
                  class="flex flex-wrap gap-2"
                >
                  <button
                    type="button"
                    class="px-2.5 py-1 text-xs font-medium rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                    @click="addClipToTimeline(scene, shot, panelVideoUrl(scene.id, shot.id)!)"
                  >
                    Add to timeline
                  </button>
                </div>

                <button
                  type="button"
                  class="mt-auto px-3 py-2 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-gray-950 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                  :disabled="
                    !finalVideoPrompt(shot, scene).trim() ||
                    !panelStoryboardUrl(shot, scene.id) ||
                    openingVideoPanelKey === genKey(scene.id, shot.id)
                  "
                  @click="openVideoGenerationForPanel(shot, scene)"
                >
                  {{
                    openingVideoPanelKey === genKey(scene.id, shot.id)
                      ? 'Opening video tool…'
                      : 'Generate video'
                  }}
                </button>
                <p
                  v-if="!panelStoryboardUrl(shot, scene.id)"
                  class="text-[11px] text-amber-800 -mt-1"
                >
                  Add a storyboard still on the Storyboard tab before generating video.
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
    </CloudProjectRequired>

    <div class="rounded-xl border border-gray-200 bg-white p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Timeline editor</h2>
      <p class="text-sm text-gray-600 mb-4">
        Drag clips on a two-track layout (video + audio). Add your own music or diegetic audio on the audio track — AI clips are generated without a score.
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
        v-if="expandedMedia"
        class="fixed inset-0 z-[100] bg-black/92 flex flex-col p-3 sm:p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="expandedMedia.kind === 'video' ? 'Video preview' : 'Storyboard frame preview'"
        @click.self="expandedMedia = null"
      >
        <div class="max-w-7xl w-full mx-auto flex flex-col flex-1 min-h-0">
          <div class="flex justify-between items-center gap-3 mb-3 text-white shrink-0">
            <p class="text-sm font-medium truncate">
              {{ expandedMedia.title }}
            </p>
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 border border-white/20"
              @click="expandedMedia = null"
            >
              Close
            </button>
          </div>
          <video
            v-if="expandedMedia.kind === 'video'"
            :src="playbackVideoSrc(expandedMedia.url)"
            class="w-full flex-1 min-h-[40vh] max-h-[calc(100vh-5rem)] rounded-lg bg-black object-contain"
            controls
            autoplay
            playsinline
          />
          <img
            v-else
            :src="expandedMedia.url"
            alt=""
            class="w-full flex-1 min-h-[40vh] max-h-[calc(100vh-5rem)] rounded-lg bg-black object-contain"
          >
        </div>
      </div>
    </Teleport>

    <div class="pt-8 border-t border-gray-200 flex flex-wrap gap-4">
      <NuxtLink
        :to="`/projects/${projectId}/storyboard`"
        class="text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        ← Storyboard
      </NuxtLink>
      <NuxtLink
        :to="`/projects/${projectId}/timeline`"
        class="text-sm text-primary font-medium hover:underline"
      >
        Next: Timeline →
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
import {
  appendPlaybackAccessToken,
  projectAssetMediaPath,
  projectAssetPlaybackSrc
} from '~/lib/project-asset-playback-url'
import { appendVideoToProjectTimeline } from '~/lib/append-project-timeline-video'
import {
  navigateToVideoGenerationFromPanel,
  type VideoGenerationPrefill
} from '~/lib/video-generation-prefill'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { storyboardFramePreviewClasses } from '~/lib/storyboard-frame-image'
import { mapStoryboardAssetsToShots } from '~/lib/storyboard-panel-assets'
import {
  buildFullVideoGenerationPrompt,
  type ProductionPromptContext
} from '~/lib/shot-character-continuity'
import type { CreativeShot } from '~/types/creative-shot'
import type { ProjectAsset } from '~/types/project-asset'

const route = useRoute()
const router = useRouter()
const { activeProject, activeProjectId, clientReady } = useCreativeProject()
const { isAuthenticated, getAuthToken } = useAuth()
const authTokenState = useState<string | null>('auth_token')
const { stepBadge } = useProjectWorkflowStep()
const toast = useToast()

const PB_ID = /^[a-z0-9]{15}$/

const project = activeProject
const projectId = activeProjectId

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
const videoPreviewByKey = reactive<Record<string, string>>({})
const expandedMedia = ref<{ kind: 'video' | 'image'; url: string; title: string } | null>(null)
const openingVideoPanelKey = ref('')
const highlightPanelKey = ref('')

const { refs: characterRefs } = useProjectCharacterRefs(projectId)

const canLoadBoards = computed(
  () => !!project.value && project.value.source === 'pocketbase' && PB_ID.test(projectId.value) && isAuthenticated.value
)

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
    const [projectRes, myRes] = await Promise.all([
      $fetch<{ items: ProjectAsset[] }>(`/api/projects/${id}/assets?kind=storyboard`, { headers }).catch(
        () => ({ items: [] as ProjectAsset[] })
      ),
      $fetch<{ items: ProjectAsset[] }>('/api/assets/my?kind=storyboard', { headers }).catch(
        () => ({ items: [] as ProjectAsset[] })
      )
    ])
    const byId = new Map<string, ProjectAsset>()
    for (const a of projectRes.items || []) {
      if (a.id) byId.set(a.id, a)
    }
    for (const a of myRes.items || []) {
      if (a.id && a.projectId === id && !byId.has(a.id)) byId.set(a.id, a)
    }
    storyboardAssets.value = [...byId.values()]
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
      videoPreviewByKey[genKey(sceneId, shotId)] = appendPlaybackAccessToken(
        projectAssetMediaPath(id, a.id),
        getAuthToken()
      )
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
  await scrollToPanelFromQuery()
}

function storyboardAssetMapForScene (sceneId: string): Map<string, ProjectAsset> {
  const sceneShots = sceneShotsBySceneId[sceneId] || []
  return mapStoryboardAssetsToShots(sceneShots, storyboardAssets.value, sceneId)
}

function storyboardAssetForShot (shot: CreativeShot, sceneId: string): ProjectAsset | null {
  return storyboardAssetMapForScene(sceneId).get(shot.id) ?? null
}

function panelStoryboardUrl (shot: CreativeShot, sceneId: string): string | null {
  const hit = storyboardAssetForShot(shot, sceneId)
  if (!hit) return null
  const url = projectAssetPlaybackSrc(hit, getAuthToken())
  return url || null
}

function panelVideoUrl (sceneId: string, shotId: string): string {
  return videoPreviewByKey[genKey(sceneId, shotId)] || ''
}

function productionPromptContext (
  shot: CreativeShot,
  scene?: SceneRow
): ProductionPromptContext {
  return {
    director: project.value?.director,
    continuityMemory: project.value?.continuityMemory,
    aspectRatio: project.value?.aspectRatio,
    targetLength: project.value?.targetLength,
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

function panelDomId (sceneId: string, shotId: string) {
  return `video-panel-${sceneId}-${shotId}`
}

async function scrollToPanelFromQuery () {
  const sceneId = typeof route.query.sceneId === 'string' ? route.query.sceneId.trim() : ''
  const shotId = typeof route.query.shotId === 'string' ? route.query.shotId.trim() : ''
  if (!sceneId || !shotId) return

  highlightPanelKey.value = genKey(sceneId, shotId)
  await nextTick()
  document.getElementById(panelDomId(sceneId, shotId))?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const q = { ...route.query }
  delete q.sceneId
  delete q.shotId
  await router.replace({ query: q })
}

function playbackVideoSrc (raw: string | undefined): string {
  void authTokenState.value
  const u = (raw || '').trim()
  if (!u) return ''
  return appendPlaybackAccessToken(u, getAuthToken())
}

function openExpandedVideo (_sceneId: string, shot: CreativeShot, url: string) {
  const u = url.trim()
  if (!u) return
  expandedMedia.value = {
    kind: 'video',
    url: u,
    title: `${shot.title || 'Shot'} · video`
  }
}

function openExpandedFrame (shot: CreativeShot, url: string) {
  const u = url.trim()
  if (!u) return
  expandedMedia.value = {
    kind: 'image',
    url: u,
    title: `${shot.title || 'Shot'} · seed frame`
  }
}

function addClipToTimeline (scene: SceneRow, shot: CreativeShot, url: string) {
  const u = url.trim()
  const pid = projectId.value
  if (!u || !PB_ID.test(pid)) return
  appendVideoToProjectTimeline(pid, {
    url: playbackVideoSrc(u),
    label: `${shot.title || 'Clip'} — ${scene.heading || 'Scene'}`.slice(0, 500),
    sceneId: scene.id,
    shotId: shot.id
  })
  toast.showToast('Clip added to timeline.', 'success')
}

function projectAspectForVideo (): '16:9' | '9:16' | '1:1' {
  if (project.value?.aspectRatio === '9:16') return '9:16'
  if (project.value?.aspectRatio === '1:1') return '1:1'
  return '16:9'
}

async function openVideoGenerationForPanel (shot: CreativeShot, scene: SceneRow) {
  const frame = panelStoryboardUrl(shot, scene.id)
  if (!frame) {
    toast.showToast('Generate a storyboard image for this panel first.', 'info')
    return
  }
  const pid = projectId.value
  if (!PB_ID.test(pid)) {
    toast.showToast('Save this project to the cloud before generating video.', 'info')
    return
  }
  const headers = authHeaders()
  if (!headers) {
    toast.showToast('Sign in to generate video for this panel.', 'info')
    return
  }

  const panelKey = genKey(scene.id, shot.id)
  openingVideoPanelKey.value = panelKey
  try {
    const prefill = await $fetch<VideoGenerationPrefill>(
      `/api/projects/${pid}/video-panel-prefill`,
      {
        query: { sceneId: scene.id, shotId: shot.id },
        headers
      }
    )
    await navigateToVideoGenerationFromPanel({
      projectId: pid,
      sceneId: scene.id,
      shotId: shot.id,
      addToTimeline: addToTimelineOnSave.value,
      prefill
    })
  } catch (e: unknown) {
    toast.showToast(
      formatApiFetchError(e, 'Could not load this panel for video generation.'),
      'error'
    )
  } finally {
    if (openingVideoPanelKey.value === panelKey) {
      openingVideoPanelKey.value = ''
    }
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
