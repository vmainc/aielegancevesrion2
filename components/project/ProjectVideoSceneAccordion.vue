<template>
  <section class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <h2 class="text-base font-semibold text-gray-900">Project video library</h2>
        <p class="text-sm text-gray-600 mt-1">
          Browse saved clips grouped by scene.
        </p>
      </div>
      <button
        type="button"
        class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 disabled:opacity-50"
        :disabled="loading"
        @click="fetchData"
      >
        Refresh
      </button>
    </div>

    <p v-if="!isAuthenticated" class="text-sm text-amber-800">
      <NuxtLink to="/login" class="text-primary font-medium underline">Log in</NuxtLink>
      to browse project clips.
    </p>
    <p v-else-if="loading" class="text-sm text-gray-600">Loading video clips…</p>
    <p v-else-if="error" class="text-sm text-red-700">{{ error }}</p>
    <p v-else-if="!sceneGroups.length" class="text-sm text-gray-600">
      No saved clips yet. Generate from the Video step or Tools → Video generation.
    </p>

    <div v-else class="space-y-3">
      <details
        v-for="scene in sceneGroups"
        :key="scene.key"
        class="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden group"
      >
        <summary
          class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-4 py-3 bg-gray-50 flex items-center justify-between gap-2 hover:bg-gray-100"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="text-gray-400 text-[10px] shrink-0 transition-transform group-open:rotate-90"
              aria-hidden="true"
            >▶</span>
            <span class="text-sm font-medium text-gray-900 truncate">{{ scene.title }}</span>
          </div>
          <span class="text-xs text-gray-500">{{ scene.items.length }} clip{{ scene.items.length === 1 ? '' : 's' }}</span>
        </summary>
        <ul class="divide-y divide-gray-200">
          <li
            v-for="a in scene.items"
            :key="a.id"
            class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 bg-white"
          >
            <div class="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-start gap-3">
              <LazyAssetVideo
                v-if="a.fileUrl"
                :src="videoSrc(a)"
              />
              <div class="min-w-0 flex-1">
                <p class="font-medium text-gray-900">{{ a.title }}</p>
                <p v-if="a.notes" class="text-sm text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">{{ a.notes }}</p>
                <p class="text-xs text-gray-400 mt-2">{{ formatDate(a.updated || a.created) }}</p>
              </div>
            </div>
          </li>
        </ul>
      </details>
    </div>
  </section>
</template>

<script setup lang="ts">
import LazyAssetVideo from '~/components/assets/LazyAssetVideo.vue'
import { buildVideoSceneGroups } from '~/lib/project-scene-groups'
import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import type { ProjectAsset } from '~/types/project-asset'

const props = defineProps<{
  projectId: string
}>()

const { isAuthenticated, getAuthToken, initAuth } = useAuth()
const authTokenState = useState<string | null>('auth_token')
const sceneHydration = useProjectScenesHydration()

const loading = ref(false)
const error = ref('')
const items = ref<ProjectAsset[]>([])

function formatDate (iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function videoSrc (a: ProjectAsset): string {
  void authTokenState.value
  if (!a.id || !props.projectId) return (a.fileUrl || '').trim()
  return appendPlaybackAccessToken(projectAssetMediaPath(props.projectId, a.id), getAuthToken())
}

const sceneGroups = computed(() => {
  void sceneHydration.revision.value
  return buildVideoSceneGroups(
    items.value,
    sceneHydration.getSceneMap(props.projectId),
    list => [...list].sort((a, b) =>
      String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || ''))
    )
  )
})

async function fetchData () {
  if (!isAuthenticated.value || !props.projectId) return
  loading.value = true
  error.value = ''
  try {
    await initAuth()
    const token = getAuthToken()
    if (!token) throw new Error('Missing auth token')
    sceneHydration.invalidateProject(props.projectId)
    const [assetRes] = await Promise.all([
      $fetch<{ items: ProjectAsset[] }>(`/api/projects/${props.projectId}/assets?kind=video`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      sceneHydration.ensureProject(props.projectId)
    ])
    items.value = assetRes.items || []
  } catch (e: unknown) {
    error.value = formatApiFetchError(e, 'Could not load project videos.')
  } finally {
    loading.value = false
  }
}

watch(() => props.projectId, () => { void fetchData() }, { immediate: true })
watch(isAuthenticated, (v) => { if (v) void fetchData() })
</script>
