<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <header class="mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
        Video generation
      </h1>
      <p class="mt-2 text-gray-600 text-sm sm:text-base max-w-2xl">
        Choose video-capable models and describe your shot. Clips can be saved to a project for your timeline and appear under Assets → Video.
      </p>
      <p
        v-if="prefillBanner"
        class="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-gray-800"
      >
        {{ prefillBanner }}
      </p>
    </header>

    <div v-if="pending" class="text-sm text-gray-600 mb-6 animate-pulse">
      Loading models…
    </div>

    <div
      v-else-if="error"
      class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-8"
    >
      {{ error }}
    </div>

    <template v-else>
      <p
        v-if="data?.notice"
        class="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"
      >
        {{ data.notice }}
      </p>

      <form class="space-y-8 mb-10" @submit.prevent="onSubmit">
        <section class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Video
          </h2>
          <div>
            <div class="flex justify-between items-center gap-2 mb-1.5">
              <label for="vg-prompt" class="text-sm font-medium text-gray-700">Prompt</label>
              <PromptEnhanceButton v-model="prompt" context="video" />
            </div>
            <textarea
              id="vg-prompt"
              v-model="prompt"
              rows="4"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
              placeholder="Describe the scene, motion, camera, mood, and duration you want"
            />
          </div>
          <VideoStartFramePicker
            v-model:frame-image-url="startFrameUrl"
            :prompt="prompt"
          />
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label for="vg-aspect" class="block text-sm font-medium text-gray-700 mb-1.5">Aspect ratio</label>
              <select
                id="vg-aspect"
                v-model="aspectRatio"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
              >
                <option value="16:9">16:9 (landscape)</option>
                <option value="9:16">9:16 (vertical)</option>
                <option value="1:1">1:1 (square)</option>
              </select>
            </div>
            <div>
              <label for="vg-duration" class="block text-sm font-medium text-gray-700 mb-1.5">Clip length</label>
              <select
                id="vg-duration"
                v-model.number="durationSeconds"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
              >
                <option :value="5">5 seconds</option>
                <option :value="10">10 seconds</option>
              </select>
            </div>
          </div>
          <p class="text-xs text-gray-500">
            Video on OpenRouter is API-only and may be in alpha.
            <a
              href="https://openrouter.ai/models?fmt=cards&output_modalities=video"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
            >Browse models on OpenRouter</a>.
          </p>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Save to project
          </h2>
          <p v-if="!isAuthenticated" class="text-sm text-amber-800">
            <NuxtLink to="/login" class="text-primary font-medium underline">Sign in</NuxtLink>
            to save clips to a project library and timeline.
          </p>
          <template v-else>
            <label class="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                v-model="saveToProject"
                type="checkbox"
                class="rounded border-gray-300 text-primary focus:ring-primary"
              >
              Save to project library (Assets → Video)
            </label>
            <div v-if="saveToProject">
              <label for="vg-project" class="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
              <select
                id="vg-project"
                v-model="selectedProjectId"
                required
                class="w-full sm:max-w-md px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
              >
                <option value="" disabled>Select project</option>
                <option v-for="p in pbProjects" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
              <p v-if="!pbProjects.length" class="mt-2 text-xs text-amber-800">
                Create a cloud project from
                <NuxtLink to="/projects" class="text-primary underline">Projects</NuxtLink>
                first.
              </p>
            </div>
            <label
              class="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer"
              :class="{ 'opacity-50 pointer-events-none': !saveToProject || !selectedProjectId }"
            >
              <input
                v-model="addToTimeline"
                type="checkbox"
                class="rounded border-gray-300 text-primary focus:ring-primary"
                :disabled="!saveToProject || !selectedProjectId"
              >
              Add to project timeline after each clip is saved
            </label>
          </template>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
            Models
          </h2>
          <p class="text-xs text-gray-500 mb-4">
            Select one or more; generations run in parallel.
            <span v-if="data?.source === 'api'" class="block sm:inline sm:ml-1 mt-1 sm:mt-0">
              Live list (<code class="rounded bg-gray-100 px-1 py-0.5 text-gray-800">output_modalities=video</code>).
            </span>
          </p>
          <div v-if="!models.length" class="text-sm text-gray-500 py-2">
            No models loaded.
          </div>
          <div v-else class="flex flex-wrap gap-3">
            <label
              v-for="m in models"
              :key="m.id"
              class="inline-flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 max-w-full sm:max-w-[calc(50%-0.375rem)]"
            >
              <input
                v-model="selectedModelIds"
                type="checkbox"
                :value="m.id"
                class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
              >
              <span class="min-w-0">
                <span class="block text-sm text-gray-800 font-medium leading-snug">{{ m.name }}</span>
                <span class="block text-xs font-mono text-gray-500 truncate mt-0.5" :title="m.id">{{ m.id }}</span>
                <span
                  v-if="m.description"
                  class="block text-xs text-gray-500 line-clamp-2 mt-1"
                >{{ m.description }}</span>
              </span>
            </label>
          </div>
        </section>

        <div v-if="formError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {{ formError }}
        </div>

        <div>
          <button
            type="submit"
            class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canSubmit"
          >
            {{ generating ? `Generating… ${doneCount}/${selectedModelIds.length}` : 'Generate Video' }}
          </button>
        </div>
      </form>

      <section v-if="hasAnySlot" class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Results</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <article
            v-for="m in models"
            v-show="selectedModelIds.includes(m.id) && slotByModel[m.id]"
            :key="m.id"
            class="rounded-xl overflow-hidden border border-gray-200 bg-white flex flex-col shadow-sm"
          >
            <div class="px-3 py-2.5 border-b border-gray-200 bg-gray-50">
              <span class="text-sm font-semibold text-gray-900">{{ m.name }}</span>
            </div>
            <div class="aspect-video bg-black flex items-center justify-center">
              <template v-if="slotByModel[m.id]?.status === 'loading'">
                <div class="flex flex-col items-center gap-2 py-10 text-gray-400">
                  <svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span class="text-xs">Rendering…</span>
                </div>
              </template>
              <video
                v-else-if="slotByModel[m.id]?.status === 'done' && slotByModel[m.id]?.playbackUrl"
                :src="playbackSrc(slotByModel[m.id]!.playbackUrl!)"
                class="w-full h-full object-contain"
                controls
                playsinline
                preload="metadata"
              />
              <p v-else-if="slotByModel[m.id]?.status === 'error'" class="text-xs text-red-400 px-4 text-center">
                {{ slotByModel[m.id]?.error }}
              </p>
            </div>
            <div
              v-if="slotByModel[m.id]?.status === 'done'"
              class="px-3 py-3 border-t border-gray-200 flex flex-wrap gap-2"
            >
              <NuxtLink
                v-if="selectedProjectId && saveToProject"
                :to="`/projects/${selectedProjectId}/timeline`"
                class="text-xs font-medium text-primary hover:underline"
              >
                Open timeline
              </NuxtLink>
              <NuxtLink
                to="/assets/video"
                class="text-xs font-medium text-gray-600 hover:text-gray-900"
              >
                Assets → Video
              </NuxtLink>
            </div>
          </article>
        </div>
      </section>

      <section v-else class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Results</h2>
        <div
          class="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 px-6 py-12 text-center text-sm text-gray-500"
        >
          Generated clips will appear here after you run Generate Video.
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { appendPlaybackAccessToken } from '~/lib/project-asset-playback-url'
import {
  clearVideoGenerationPrefill,
  loadVideoGenerationPrefill,
  useVideoGenerationPrefillState,
  type VideoGenerationPrefill
} from '~/lib/video-generation-prefill'
import {
  generateOpenRouterVideo,
  playbackUrlForProjectVideoAsset,
  saveVideoToProjectLibrary
} from '~/composables/useOpenRouterVideoGen'
import type { CreativeProject } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

type VideoModel = {
  id: string
  name: string
  description?: string
  supportedDurations?: number[]
}

type ApiPayload = {
  source?: string
  models?: VideoModel[]
  notice?: string
}

type Slot = {
  status: 'loading' | 'done' | 'error'
  playbackUrl?: string
  error?: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { isAuthenticated, getAuthToken, initAuth } = useAuth()
const authTokenState = useState<string | null>('auth_token')
const { projects, loadServerProjects, clientReady } = useCreativeProject()

const { data, pending, error: fetchError } = await useFetch<ApiPayload>('/api/openrouter/video-models')

const error = computed(() => {
  if (fetchError.value) return 'Could not load models. Try again later.'
  return null
})

const models = computed(() => data.value?.models ?? [])

const prompt = ref('')
const startFrameUrl = ref<string | null>(null)
const aspectRatio = ref<'16:9' | '9:16' | '1:1'>('16:9')
const durationSeconds = ref(5)
const selectedModelIds = ref<string[]>([])
const formError = ref('')
const generating = ref(false)
const doneCount = ref(0)
const saveToProject = ref(true)
const addToTimeline = ref(false)
const selectedProjectId = ref('')
const slotByModel = reactive<Record<string, Slot>>({})
const panelPrefill = ref<VideoGenerationPrefill | null>(null)
const prefillBanner = ref('')
/** Project id from project Video step — kept until the project list loads. */
const pinnedProjectId = ref('')
const prefillApplied = ref(false)

const pbProjects = computed(() =>
  projects.value.filter((p: CreativeProject) => PB_ID.test(p.id))
)

function syncSelectedProjectFromPin () {
  const pin = pinnedProjectId.value.trim()
  if (!pin || !PB_ID.test(pin)) return
  if (pbProjects.value.some(p => p.id === pin)) {
    selectedProjectId.value = pin
  }
}

watch([pbProjects, clientReady], () => {
  if (pinnedProjectId.value) {
    syncSelectedProjectFromPin()
    return
  }
  if (!selectedProjectId.value && pbProjects.value.length) {
    selectedProjectId.value = pbProjects.value[0].id
  }
}, { immediate: true })

function applyVideoGenerationPrefill (p: VideoGenerationPrefill, queryProjectId?: string) {
  panelPrefill.value = p
  prompt.value = p.prompt.trim()
  if (p.startFrameUrl) startFrameUrl.value = p.startFrameUrl
  if (p.aspectRatio) aspectRatio.value = p.aspectRatio
  if (typeof p.durationSeconds === 'number' && (p.durationSeconds === 5 || p.durationSeconds === 10)) {
    durationSeconds.value = p.durationSeconds
  }
  if (p.saveToProject !== undefined) saveToProject.value = p.saveToProject
  if (p.addToTimeline !== undefined) addToTimeline.value = p.addToTimeline
  const pid =
    (p.projectId && PB_ID.test(p.projectId) ? p.projectId : '') ||
    (queryProjectId && PB_ID.test(queryProjectId) ? queryProjectId : '')
  if (pid) {
    pinnedProjectId.value = pid
    selectedProjectId.value = pid
    saveToProject.value = true
    syncSelectedProjectFromPin()
  }
  const label = (p.shotTitle || '').trim()
  prefillBanner.value = label
    ? `Opened from project storyboard — “${label}”. Prompt and seed frame are prefilled; pick one or more models below.`
    : 'Opened from a project panel — prompt and seed frame are prefilled; pick one or more models below.'
}

const prefillState = useVideoGenerationPrefillState()

function stripPrefillFromRoute () {
  if (!route.query.prefill && !route.query.projectId) return
  const q = { ...route.query }
  delete q.prefill
  delete q.projectId
  void router.replace({ path: route.path, query: q })
}

function consumePrefillQuery () {
  if (prefillApplied.value) return

  const id = typeof route.query.prefill === 'string' ? route.query.prefill.trim() : ''
  const queryProjectId =
    typeof route.query.projectId === 'string' ? route.query.projectId.trim() : ''
  const statePayload = prefillState.value

  if (!id && !statePayload && !queryProjectId) return

  let payload: VideoGenerationPrefill | null = statePayload
  if (!payload && id) {
    payload = loadVideoGenerationPrefill(id)
  }

  if (payload) {
    applyVideoGenerationPrefill(payload, queryProjectId)
    prefillApplied.value = true
    prefillState.value = null
    if (id) clearVideoGenerationPrefill(id)
    stripPrefillFromRoute()
    return
  }

  if (queryProjectId && PB_ID.test(queryProjectId)) {
    pinnedProjectId.value = queryProjectId
    selectedProjectId.value = queryProjectId
    saveToProject.value = true
    syncSelectedProjectFromPin()
    prefillApplied.value = true
    stripPrefillFromRoute()
    return
  }

  if (id) {
    toast.showToast('Prefill data expired — open Generate video from the project again.', 'info')
    stripPrefillFromRoute()
  }
}

onBeforeMount(() => {
  consumePrefillQuery()
})

onMounted(() => {
  if (isAuthenticated.value && clientReady.value) {
    void loadServerProjects().then(() => {
      syncSelectedProjectFromPin()
    })
  }
})

watch(
  () => prefillState.value,
  (state) => {
    if (state && !prefillApplied.value) consumePrefillQuery()
  }
)

watch(
  () => route.query.prefill,
  (prefill) => {
    if (typeof prefill === 'string' && prefill.trim() && !prefillApplied.value) {
      consumePrefillQuery()
    }
  }
)

watch(isAuthenticated, (v) => {
  if (v) {
    void loadServerProjects().then(() => {
      syncSelectedProjectFromPin()
    })
  }
})

watch(saveToProject, (v) => {
  if (!v) addToTimeline.value = false
})

const hasAnySlot = computed(() => Object.keys(slotByModel).length > 0)

const canSubmit = computed(() =>
  !generating.value &&
  selectedModelIds.value.length > 0 &&
  prompt.value.trim().length > 0 &&
  !pending.value &&
  (!saveToProject.value || (selectedProjectId.value && pbProjects.value.some(p => p.id === selectedProjectId.value)))
)

function playbackSrc (url: string): string {
  void authTokenState.value
  return appendPlaybackAccessToken(url, getAuthToken())
}

function authHeaders (): Record<string, string> | null {
  const token = getAuthToken()
  if (!token) return null
  return { Authorization: `Bearer ${token}` }
}

function clipTitle (): string {
  const fromPanel = (panelPrefill.value?.shotTitle || '').trim()
  if (fromPanel) return `${fromPanel} — video`.slice(0, 500)
  const base = prompt.value.trim().slice(0, 80) || 'Generated clip'
  return `${base} — video`.slice(0, 500)
}

async function runOneModel (modelId: string) {
  const model = models.value.find(m => m.id === modelId)
  slotByModel[modelId] = { status: 'loading' }
  try {
    const { videoUrl } = await generateOpenRouterVideo({
      prompt: prompt.value,
      model: modelId,
      aspectRatio: aspectRatio.value,
      durationSeconds: durationSeconds.value,
      frameImageUrl: startFrameUrl.value || undefined,
      supportedDurations: model?.supportedDurations
    })

    let playbackUrl = videoUrl
    const headers = authHeaders()

    if (saveToProject.value && selectedProjectId.value && headers) {
      const pre = panelPrefill.value
      const asset = await saveVideoToProjectLibrary({
        projectId: selectedProjectId.value,
        remoteUrl: videoUrl,
        title: clipTitle(),
        notes: pre?.source === 'project_video_panel'
          ? 'Generated from project Video step via Video tools.'
          : 'Generated from Video tools (standalone).',
        metadata: {
          model_id: modelId,
          source: pre?.source || 'standalone_video_tool',
          aspect_ratio: aspectRatio.value,
          duration_seconds: durationSeconds.value,
          ...(pre?.sceneId ? { scene_id: pre.sceneId } : {}),
          ...(pre?.shotId ? { shot_id: pre.shotId } : {})
        },
        headers
      })
      if (asset?.id) {
        playbackUrl = playbackUrlForProjectVideoAsset(selectedProjectId.value, asset.id)
      } else {
        toast.showToast(
          'Video rendered but saving to your library failed — clip may not play in-browser without saving.',
          'warning'
        )
      }
    }

    if (addToTimeline.value && selectedProjectId.value && playbackUrl) {
      const { addVideoClip } = useProjectTimeline(computed(() => selectedProjectId.value))
      addVideoClip({
        url: playbackSrc(playbackUrl),
        label: clipTitle(),
        ...(panelPrefill.value?.sceneId ? { sceneId: panelPrefill.value.sceneId } : {}),
        ...(panelPrefill.value?.shotId ? { shotId: panelPrefill.value.shotId } : {})
      })
    }

    slotByModel[modelId] = { status: 'done', playbackUrl }
    doneCount.value += 1
  } catch (e: unknown) {
    slotByModel[modelId] = {
      status: 'error',
      error: formatApiFetchError(e, 'Generation failed')
    }
    doneCount.value += 1
  }
}

async function onSubmit () {
  formError.value = ''
  if (!prompt.value.trim()) {
    formError.value = 'Enter a prompt.'
    return
  }
  if (!selectedModelIds.value.length) {
    formError.value = 'Select at least one model.'
    return
  }
  if (saveToProject.value) {
    if (!isAuthenticated.value) {
      formError.value = 'Sign in to save clips to a project.'
      return
    }
    await initAuth()
    if (!selectedProjectId.value) {
      formError.value = 'Choose a project to save into.'
      return
    }
  }

  generating.value = true
  doneCount.value = 0
  for (const id of selectedModelIds.value) {
    delete slotByModel[id]
  }
  for (const id of selectedModelIds.value) {
    slotByModel[id] = { status: 'loading' }
  }

  await Promise.all(selectedModelIds.value.map(id => runOneModel(id)))

  generating.value = false
  const anyOk = selectedModelIds.value.some(id => slotByModel[id]?.status === 'done')
  if (anyOk && saveToProject.value) {
    toast.showToast('Saved to project library — see Assets → Video.', 'success')
  } else if (anyOk) {
    toast.showToast('Video generation finished.', 'success')
  }
}

useHead({
  title: 'Video generation — AI Elegance',
  meta: [{ name: 'description', content: 'Select video models and describe your shot on AI Elegance.' }]
})
</script>
