<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <nav class="text-sm text-gray-500 mb-6">
      <NuxtLink to="/assets" class="hover:text-primary">Assets</NuxtLink>
      <span class="mx-2" aria-hidden="true">/</span>
      <span class="text-gray-900">{{ headline }}</span>
    </nav>

    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{{ headline }}</h1>
    <p class="text-gray-600 text-sm sm:text-base mb-6 max-w-2xl">
      {{ blurb }}
    </p>

    <div class="flex flex-wrap gap-2 mb-8">
      <NuxtLink
        v-for="a in actions"
        :key="a.to"
        :to="a.to"
        class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        :class="a.primary
          ? 'bg-primary hover:bg-primary/90 text-gray-950'
          : 'border border-gray-300 text-gray-800 hover:bg-gray-50'"
      >
        {{ a.label }}
      </NuxtLink>
      <ClientOnly>
        <button
          v-if="isAuthenticated"
          type="button"
          class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors"
          @click="openAdd = true"
        >
          Add {{ addButtonLabel }}
        </button>
      </ClientOnly>
    </div>

    <ClientOnly>
      <div v-if="!isAuthenticated" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Sign in to see your {{ headline.toLowerCase() }} library and add entries.
      </div>

      <template v-else>
        <p v-if="loadError" class="text-sm text-red-700 mb-4">{{ loadError }}</p>
        <p v-else-if="loading" class="text-sm text-gray-600 mb-4">Loading…</p>

        <div
          v-else-if="characterFilterLabel"
          class="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary"
        >
          Showing images for: <span class="font-semibold">{{ characterFilterLabel }}</span>
        </div>

        <AssetKindVideoGroups
          v-if="props.kind === 'video' && videoProjectGroups.length"
          :groups="videoProjectGroups"
          :deleting-id="deletingId"
          :scene-groups-for-project="videoSceneGroupsForProject"
          :video-asset-playback-src="videoAssetPlaybackSrc"
          :format-date="formatDate"
          :move-target-projects="moveTargetProjects"
          :add-video-asset-to-timeline="addVideoAssetToTimeline"
          :open-move-video="openMoveVideo"
          :remove-asset="removeAsset"
        />

        <AssetKindCharacterGroups
          v-else-if="props.kind === 'character' && characterProjectGroups.length"
          :groups="characterProjectGroups"
          :deleting-id="deletingId"
          :featuring-id="featuringId"
          :uploading-character-asset-id="uploadingCharacterAssetId"
          :character-profile-to="characterProfileTo"
          :character-asset-playback-src="characterAssetPlaybackSrc"
          :character-creator-to="characterCreatorTo"
          :script-source-line="scriptSourceLine"
          :format-date="formatDate"
          :open-image-preview="openImagePreview"
          :trigger-character-image-upload="triggerCharacterImageUpload"
          :set-featured-character-image="setFeaturedCharacterImage"
          :remove-asset="removeAsset"
        />

        <AssetKindLibraryGroups
          v-else-if="libraryKindProjectGroups.length"
          :groups="libraryKindProjectGroups"
          :kind="props.kind"
          :deleting-id="deletingId"
          :reading-script-id="readingScriptId"
          :library-image-src="libraryImageSrc"
          :script-source-line="scriptSourceLine"
          :format-date="formatDate"
          :project-hub-step-to="projectHubStepTo"
          :open-image-preview="openImagePreview"
          :open-script-reader="openScriptReader"
          :remove-asset="removeAsset"
        />

        <ul
          v-else-if="visibleItems.length"
          class="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white"
        >
          <li
            v-for="a in visibleItems"
            :key="a.id"
            class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 relative first:rounded-t-xl last:rounded-b-xl hover:z-10 focus-within:z-10"
          >
            <div class="min-w-0 flex-1 flex items-start gap-3">
              <button
                v-if="props.kind === 'character' && a.fileUrl"
                type="button"
                class="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0 cursor-zoom-in hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                :aria-label="`View full image: ${a.title}`"
                @click="openImagePreview(a)"
              >
                <img
                  :src="characterAssetPlaybackSrc(a)"
                  alt=""
                  class="w-full h-full object-cover pointer-events-none"
                  loading="lazy"
                >
              </button>
              <button
                v-else-if="props.kind === 'character' && a.projectId && !a.fileUrl"
                type="button"
                class="w-14 h-14 rounded-lg border border-dashed border-gray-300 bg-gray-50 shrink-0 flex flex-col items-center justify-center text-[10px] leading-tight text-gray-500 hover:border-primary/40 hover:text-primary px-1"
                :disabled="uploadingCharacterAssetId === a.id"
                @click="triggerCharacterImageUpload(a)"
              >
                {{ uploadingCharacterAssetId === a.id ? '…' : 'Add image' }}
              </button>
              <div
                v-else-if="props.kind === 'video' && a.fileUrl"
                class="w-full max-w-[min(100%,20rem)] sm:max-w-xs rounded-lg border border-gray-200 overflow-hidden bg-black shrink-0"
              >
                <video
                  :src="videoAssetPlaybackSrc(a)"
                  class="w-full aspect-video object-contain"
                  controls
                  playsinline
                  preload="metadata"
                />
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-medium text-gray-900">{{ a.title }}</p>
                <p
                  v-if="props.kind === 'character' && isFeaturedCharacterAsset(a)"
                  class="text-[11px] font-semibold text-emerald-700 mt-0.5"
                >
                  Featured image
                </p>
                <p v-if="scriptSourceLine(a)" class="text-xs font-medium text-primary mt-1">
                  {{ scriptSourceLine(a) }}
                </p>
                <p v-if="a.projectName" class="text-xs text-gray-500 mt-0.5">Project: {{ a.projectName }}</p>
                <p v-if="a.notes" class="text-sm text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">{{ a.notes }}</p>
                <p class="text-xs text-gray-400 mt-2">{{ formatDate(a.updated || a.created) }}</p>
              </div>
            </div>
            <div class="shrink-0">
              <details class="relative open:z-30">
                <summary
                  class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Actions
                </summary>
                <div :class="ACTIONS_MENU_PANEL_CLASS">
                  <button
                    v-if="props.kind === 'character' && a.projectId"
                    type="button"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    :disabled="uploadingCharacterAssetId === a.id"
                    @click="triggerCharacterImageUpload(a)"
                  >
                    {{ uploadingCharacterAssetId === a.id ? 'Uploading…' : 'Upload image' }}
                  </button>
                  <button
                    v-if="props.kind === 'script'"
                    type="button"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    :disabled="readingScriptId === a.id"
                    @click="openScriptReader(a)"
                  >
                    {{ readingScriptId === a.id ? 'Loading…' : 'Read script' }}
                  </button>
                  <a
                    v-if="a.fileUrl"
                    :href="a.fileUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                  >
                    Download file
                  </a>
                  <NuxtLink
                    v-if="a.projectId"
                    :to="projectOverviewPath(a)"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                  >
                    {{ props.kind === 'script' && scriptNeedsFullImport(a) ? 'Import into project' : 'Open project' }}
                  </NuxtLink>
                  <NuxtLink
                    v-if="props.kind === 'character'"
                    :to="characterCreatorTo(a)"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                  >
                    Open in Character Creator
                  </NuxtLink>
                  <button
                    v-if="props.kind === 'character' && a.projectId && a.fileUrl"
                    type="button"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    :disabled="featuringId === a.id"
                    @click="setFeaturedCharacterImage(a)"
                  >
                    {{ featuringId === a.id ? 'Setting…' : 'Set as featured' }}
                  </button>
                  <button
                    type="button"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    :disabled="deletingId === a.id"
                    @click="removeAsset(a)"
                  >
                    {{ deletingId === a.id ? 'Removing…' : 'Remove' }}
                  </button>
                </div>
              </details>
            </div>
          </li>
        </ul>

        <div
          v-else
          class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center"
        >
          <p class="text-gray-700 text-sm mb-2">Nothing in this library yet.</p>
          <p class="text-gray-500 text-sm mb-4">
            {{ emptyHint }}
          </p>
        </div>
      </template>
    </ClientOnly>

    <input
      ref="characterImageFileInput"
      type="file"
      class="hidden"
      accept="image/jpeg,image/png,image/webp,image/gif,image/*"
      @change="onCharacterImageFilePicked"
    >

    <AssetKindModals
      :expanded-image="expandedImage"
      :expanded-script="expandedScript"
      :open-move="openMove"
      :move-target="moveTarget"
      :move-project-id="moveProjectId"
      :move-destination-projects="moveDestinationProjects"
      :moving="moving"
      :move-error="moveError"
      :open-add="openAdd"
      :add-button-label="addButtonLabel"
      :modal-title-id="modalTitleId"
      :projects="pbProjects"
      :add-form="addForm"
      :add-error="addError"
      :adding="adding"
      @close-image="closeImagePreview"
      @close-script="closeScriptReader"
      @close-move="closeMove"
      @submit-move="submitMove"
      @close-add="closeAdd"
      @submit-add="submitAdd"
      @update:move-project-id="moveProjectId = $event"
      @update:add-form="Object.assign(addForm, $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { appendVideoToProjectTimeline } from '~/lib/append-project-timeline-video'
import { timelineAppendToast } from '~/lib/timeline-append-feedback'
import { pocketBaseBearerHeaders } from '~/lib/pocketbase-auth-headers'
import { buildVideoSceneGroups } from '~/lib/project-scene-groups'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { visualBriefForCharacterCreator } from '~/lib/character-visual-description'
import { prepareImageFileForUpload } from '~/lib/image-blob-client'
import { groupProjectAssetsByProject, sortProjectAssetsWithinProjectByKind } from '~/lib/project-asset-sort'
import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import {
  ACTIONS_MENU_PANEL_CLASS,
  PB_ID,
  buildProjectAssetGroups,
  characterMetaFromAsset,
  dedupeCharacterAssets,
  isFeaturedCharacterAsset,
  isStoredProjectAsset,
  normalizeName,
  scriptNeedsFullImport as assetScriptNeedsFullImport,
  scriptSourceLine as assetScriptSourceLine,
  sortCharacterAssetsForDisplay,
  type AssetProjectGroup
} from '~/lib/asset-kind-display'
import AssetKindVideoGroups from '~/components/assets/AssetKindVideoGroups.vue'
import AssetKindCharacterGroups from '~/components/assets/AssetKindCharacterGroups.vue'
import AssetKindLibraryGroups from '~/components/assets/AssetKindLibraryGroups.vue'
import AssetKindModals from '~/components/assets/AssetKindModals.vue'
import type { ProjectAsset, ProjectAssetKind } from '~/types/project-asset'
import type { CreativeProject } from '~/types/creative-project'

const props = defineProps<{
  kind: ProjectAssetKind
  headline: string
  blurb: string
  /** Primary + secondary CTAs */
  actions: { to: string; label: string; primary?: boolean }[]
  emptyHint: string
}>()

const addButtonLabel = computed(() => {
  const m: Record<ProjectAssetKind, string> = {
    script: 'script entry',
    character: 'character asset',
    storyboard: 'storyboard entry',
    video: 'video entry',
    other: 'entry'
  }
  return m[props.kind] || 'entry'
})

const modalTitleId = `asset-add-${props.kind}`

const { isAuthenticated, initAuth, getAuthToken } = useAuth()
const authTokenState = useState<string | null>('auth_token')
const { projects, loadServerProjects, clientReady } = useCreativeProject()
const toast = useToast()
const sceneHydration = useProjectScenesHydration()
const route = useRoute()

const loading = ref(true)
const loadError = ref('')
const items = ref<ProjectAsset[]>([])
const openAdd = ref(false)
const expandedImage = ref<{ url: string; title: string; downloadUrl: string } | null>(null)
const expandedScript = ref<{ title: string; text: string; partial?: boolean } | null>(null)
const readingScriptId = ref('')
const adding = ref(false)
const addError = ref('')
const deletingId = ref('')
const featuringId = ref('')
const uploadingCharacterAssetId = ref('')
const characterImageFileInput = ref<HTMLInputElement | null>(null)
const uploadTargetAsset = ref<ProjectAsset | null>(null)
const openMove = ref(false)
const moveTarget = ref<ProjectAsset | null>(null)
const moveProjectId = ref('')
const moving = ref(false)
const moveError = ref('')

const addForm = reactive({
  projectId: '',
  title: '',
  notes: ''
})

const pbProjects = computed(() =>
  projects.value.filter((p: CreativeProject) => PB_ID.test(p.id))
)

function formatDate (iso: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  } catch {
    return iso
  }
}

function assetMediaPlaybackSrc (a: ProjectAsset): string {
  void authTokenState.value
  if (!a.id || !a.projectId || !PB_ID.test(a.projectId)) {
    return (a.fileUrl || '').trim()
  }
  return appendPlaybackAccessToken(projectAssetMediaPath(a.projectId, a.id), getAuthToken())
}

function videoAssetPlaybackSrc (a: ProjectAsset): string {
  if (props.kind !== 'video') return (a.fileUrl || '').trim()
  return assetMediaPlaybackSrc(a)
}

function characterAssetPlaybackSrc (a: ProjectAsset): string {
  if (props.kind !== 'character') return (a.fileUrl || '').trim()
  return assetMediaPlaybackSrc(a)
}

function libraryImageSrc (a: ProjectAsset): string {
  if (!a.id) return (a.fileUrl || '').trim()
  if (props.kind === 'storyboard' || props.kind === 'character') {
    return assetMediaPlaybackSrc(a)
  }
  return (a.fileUrl || '').trim()
}

function openImagePreview (a: ProjectAsset) {
  const url =
    props.kind === 'character'
      ? characterAssetPlaybackSrc(a)
      : libraryImageSrc(a)
  if (!url) return
  expandedImage.value = {
    url,
    title: a.title || (props.kind === 'storyboard' ? 'Storyboard frame' : 'Character image'),
    downloadUrl: url
  }
}

function closeImagePreview () {
  expandedImage.value = null
}

async function openScriptReader (a: ProjectAsset) {
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Sign in to read scripts.', 'info')
    return
  }
  readingScriptId.value = a.id
  try {
    const res = await $fetch<{ title: string; text: string; partial?: boolean }>(
      `/api/assets/${a.id}/script-text`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expandedScript.value = {
      title: res.title || a.title || 'Script',
      text: res.text || '',
      partial: res.partial
    }
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load script')
        : 'Could not load script'
    toast.showToast(msg, 'error')
  } finally {
    readingScriptId.value = ''
  }
}

function closeScriptReader () {
  expandedScript.value = null
}

/** Where a script file came from + whether AI import was run (scripts hub only). */
function scriptNeedsFullImport (a: ProjectAsset): boolean {
  return assetScriptNeedsFullImport(props.kind, a)
}

function projectOverviewPath (a: ProjectAsset): string {
  if (!a.projectId) return '/projects'
  if (props.kind === 'script' && scriptNeedsFullImport(a)) {
    return `/projects/${a.projectId}/overview?bootstrap=1`
  }
  if (props.kind === 'script') {
    return `/projects/${a.projectId}/overview`
  }
  return `/projects/${a.projectId}/home`
}

function scriptSourceLine (a: ProjectAsset): string {
  return assetScriptSourceLine(props.kind, a)
}

function firstQueryString (v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return ''
}

/** Profile page route when this row has a real project + character id, else '' (fall back to lightbox). */
function characterProfileTo (a: ProjectAsset): string {
  if (props.kind !== 'character') return ''
  const pid = (a.projectId || '').trim()
  if (!PB_ID.test(pid)) return ''
  const m = characterMetaFromAsset(a)
  if (!m.id || !PB_ID.test(m.id)) return ''
  // Pass the name so the profile can self-heal if the id is stale (deleted/recreated character).
  const q = m.name ? `?name=${encodeURIComponent(m.name)}` : ''
  return `/projects/${pid}/cast/${m.id}${q}`
}

function characterCreatorTo (a: ProjectAsset) {
  const m = characterMetaFromAsset(a)
  const name = (m.name || (a.title || '').split('—')[0]?.trim() || a.title || '').slice(0, 200)
  const meta = a.metadata && typeof a.metadata === 'object' ? (a.metadata as Record<string, unknown>) : null
  const promptUsed =
    meta && typeof meta.prompt_used === 'string' ? meta.prompt_used.trim() : ''
  const description = visualBriefForCharacterCreator({
    name,
    roleDescription: '',
    portraitUrl: a.fileUrl,
    portraitNotes: (a.notes || '').trim(),
    portraitPromptUsed: promptUsed
  })
  const q: Record<string, string> = { name }
  if (description) q.description = description
  if (a.projectId && PB_ID.test(a.projectId)) q.projectId = a.projectId
  if (m.id && PB_ID.test(m.id)) q.characterId = m.id
  return {
    path: '/character-creator',
    query: q
  }
}

const characterFilterId = computed(() => firstQueryString(route.query.characterId).trim())
const characterFilterName = computed(() => firstQueryString(route.query.characterName).trim())
const characterFilterProjectId = computed(() => firstQueryString(route.query.projectId).trim())
const characterFilterLabel = computed(() => {
  if (props.kind !== 'character') return ''
  return characterFilterName.value || characterFilterId.value || ''
})

const visibleItems = computed(() => {
  let out = [...items.value]
  if (props.kind !== 'character') return out
  if (characterFilterProjectId.value) {
    out = out.filter(a => a.projectId === characterFilterProjectId.value)
  }
  if (!characterFilterId.value && !characterFilterName.value) {
    return props.kind === 'character' ? dedupeCharacterAssets(out) : out
  }
  const wantedName = normalizeName(characterFilterName.value)
  const filtered = out.filter((a) => {
    const m = characterMetaFromAsset(a)
    if (characterFilterId.value && m.id === characterFilterId.value) return true
    if (wantedName) {
      if (normalizeName(m.name) === wantedName) return true
      if (normalizeName(a.title || '').includes(wantedName)) return true
    }
    return false
  })
  return props.kind === 'character' ? dedupeCharacterAssets(filtered) : filtered
})

type AssetSceneGroup = {
  key: string
  title: string
  items: ProjectAsset[]
}

function sortVideoAssetsForDisplay (list: ProjectAsset[]): ProjectAsset[] {
  return [...list].sort((a, b) =>
    String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || ''))
  )
}

function videoSceneGroupsForProject (group: AssetProjectGroup): AssetSceneGroup[] {
  void sceneHydration.revision.value
  const sceneMap = group.projectId && PB_ID.test(group.projectId)
    ? sceneHydration.getSceneMap(group.projectId)
    : new Map()
  return buildVideoSceneGroups(group.items, sceneMap, sortVideoAssetsForDisplay)
}

const characterProjectGroups = computed<AssetProjectGroup[]>(() => {
  if (props.kind !== 'character') return []
  return buildProjectAssetGroups(visibleItems.value, projects.value, sortCharacterAssetsForDisplay)
})

const videoProjectGroups = computed<AssetProjectGroup[]>(() => {
  if (props.kind !== 'video') return []
  return buildProjectAssetGroups(visibleItems.value, projects.value, sortVideoAssetsForDisplay)
})

watch(
  [videoProjectGroups, () => props.kind, isAuthenticated],
  () => {
    if (props.kind !== 'video' || !isAuthenticated.value) return
    const ids = videoProjectGroups.value
      .map(g => g.projectId)
      .filter((id): id is string => Boolean(id && PB_ID.test(id)))
    void sceneHydration.ensureProjects(ids)
  },
  { immediate: true }
)

const libraryKindProjectGroups = computed(() => {
  if (props.kind === 'character' || props.kind === 'video') return []
  return groupProjectAssetsByProject(visibleItems.value, sortProjectAssetsWithinProjectByKind)
})

function projectHubStepTo (projectId: string): string {
  if (props.kind === 'storyboard') return `/projects/${projectId}/storyboard`
  if (props.kind === 'script') return `/projects/${projectId}/overview`
  return `/projects/${projectId}/home`
}

async function addVideoAssetToTimeline (a: ProjectAsset) {
  if (!a.projectId || !PB_ID.test(a.projectId) || !a.id) return
  const src = videoAssetPlaybackSrc(a)
  if (!src) return
  const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
  const sceneId = typeof meta.scene_id === 'string' ? meta.scene_id : undefined
  const shotId = typeof meta.shot_id === 'string' ? meta.shot_id : undefined
  const result = await appendVideoToProjectTimeline(a.projectId, {
    url: src,
    label: (a.title || 'Video clip').slice(0, 500),
    sceneId,
    shotId,
    assetId: a.id
  }, { authHeaders: pocketBaseBearerHeaders(getAuthToken()) })
  const t = timelineAppendToast(result.outcome, 'video')
  toast.showToast(t.message, t.type)
}

async function fetchItems () {
  if (!import.meta.client || !isAuthenticated.value) {
    loading.value = false
    return
  }
  const token = getAuthToken()
  if (!token) {
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    await initAuth()
    const res = await $fetch<{ items: ProjectAsset[] }>(`/api/assets/my?kind=${encodeURIComponent(props.kind)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    items.value = res.items ?? []
  } catch (e) {
    loadError.value = formatApiFetchError(e, 'Could not load assets')
  } finally {
    loading.value = false
  }
}

watch([isAuthenticated, clientReady], () => {
  if (isAuthenticated.value && clientReady.value) {
    void loadServerProjects()
  }
})

onMounted(() => {
  if (isAuthenticated.value && clientReady.value) {
    void loadServerProjects()
  }
  void fetchItems()
})

watch(isAuthenticated, (v) => {
  if (v) {
    void loadServerProjects()
    void fetchItems()
  } else {
    items.value = []
    loading.value = false
  }
})

function moveTargetProjects (a: ProjectAsset | null): CreativeProject[] {
  if (!a?.projectId) return pbProjects.value
  return pbProjects.value.filter(p => p.id !== a.projectId)
}

const moveDestinationProjects = computed(() => moveTargetProjects(moveTarget.value))

function openMoveVideo (a: ProjectAsset) {
  moveTarget.value = a
  moveProjectId.value = moveTargetProjects(a)[0]?.id || ''
  moveError.value = ''
  openMove.value = true
}

function closeMove () {
  openMove.value = false
  moveTarget.value = null
  moveProjectId.value = ''
  moveError.value = ''
}

async function submitMove () {
  const a = moveTarget.value
  const token = getAuthToken()
  if (!a?.id || !token || !moveProjectId.value) return
  moving.value = true
  moveError.value = ''
  try {
    await $fetch(`/api/assets/${a.id}/move`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { projectId: moveProjectId.value }
    })
    const dest = pbProjects.value.find(p => p.id === moveProjectId.value)
    toast.showToast(
      dest ? `Moved to “${dest.name}”.` : 'Moved to project.',
      'success'
    )
    closeMove()
    await fetchItems()
  } catch (e) {
    moveError.value = formatApiFetchError(e, 'Could not move clip')
  } finally {
    moving.value = false
  }
}

function closeAdd () {
  if (adding.value) return
  openAdd.value = false
  addError.value = ''
  addForm.projectId = ''
  addForm.title = ''
  addForm.notes = ''
}

async function submitAdd () {
  const token = getAuthToken()
  if (!token || !addForm.projectId) return
  adding.value = true
  addError.value = ''
  try {
    await $fetch(`/api/projects/${addForm.projectId}/assets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        kind: props.kind,
        title: addForm.title.trim(),
        notes: addForm.notes.trim(),
        sort_order: 0
      }
    })
    toast.showToast('Saved to library.', 'success')
    closeAdd()
    await fetchItems()
  } catch (e) {
    addError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Save failed')
        : 'Save failed'
  } finally {
    adding.value = false
  }
}

async function removeAsset (a: ProjectAsset) {
  const token = getAuthToken()
  if (!token) return
  if (!confirm(`Remove “${a.title}” from this library?`)) return
  deletingId.value = a.id
  try {
    const meta = a.metadata as { source?: string; character_id?: string } | null
    if (props.kind === 'character' && meta?.source === 'creative_character_row' && a.projectId && meta.character_id) {
      await $fetch(`/api/projects/${a.projectId}/characters/${meta.character_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    } else if (a.projectId) {
      await $fetch(`/api/projects/${a.projectId}/assets/${a.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    } else {
      await $fetch(`/api/assets/${a.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    }
    toast.showToast('Removed.', 'success')
    await fetchItems()
  } catch {
    toast.showToast('Could not remove.', 'error')
  } finally {
    deletingId.value = ''
  }
}

function characterDisplayName (a: ProjectAsset): string {
  const m = characterMetaFromAsset(a)
  const fromTitle = (a.title || '').split('—')[0]?.trim() || ''
  return (m.name || fromTitle || a.title || 'Character').slice(0, 200)
}

async function resolveOrCreateCharacterForUpload (
  projectId: string,
  characterName: string,
  roleDescription: string,
  token: string
): Promise<{ id: string; name: string }> {
  const targetName = characterName.trim().slice(0, 200) || 'Character'
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')
  const existing = await $fetch<{ characters: Array<{ id: string; name: string }> }>(
    `/api/projects/${projectId}/characters`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const hit = (existing.characters || []).find(c => norm(c.name || '') === norm(targetName))
  if (hit?.id) return { id: hit.id, name: hit.name || targetName }
  const created = await $fetch<{ character?: { id: string; name: string } }>(
    `/api/projects/${projectId}/characters`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: targetName,
        roleDescription: roleDescription.slice(0, 10_000),
        screenSharePercent: null
      }
    }
  )
  if (created.character?.id) {
    return { id: created.character.id, name: created.character.name || targetName }
  }
  throw new Error('Could not create character row for this image.')
}

function triggerCharacterImageUpload (a: ProjectAsset) {
  if (props.kind !== 'character' || !a.projectId) return
  uploadTargetAsset.value = a
  characterImageFileInput.value?.click()
}

async function onCharacterImageFilePicked (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const target = uploadTargetAsset.value
  uploadTargetAsset.value = null
  if (!file || !target?.projectId) return
  if (!file.type.startsWith('image/')) {
    toast.showToast('Choose an image file (JPEG, PNG, WebP, or GIF).', 'warning')
    return
  }
  const token = getAuthToken()
  if (!token) return
  uploadingCharacterAssetId.value = target.id
  try {
    const uploadFile = await prepareImageFileForUpload(file)
    const charName = characterDisplayName(target)
    const linked = await resolveOrCreateCharacterForUpload(
      target.projectId,
      charName,
      target.notes || '',
      token
    )
    const fd = new FormData()
    fd.append('file', uploadFile)
    fd.append('kind', 'character')
    fd.append('title', `${charName} — uploaded`.slice(0, 500))
    fd.append('notes', (target.notes || '').slice(0, 20_000))
    fd.append(
      'metadata',
      JSON.stringify({
        source: 'character_upload',
        character_name: linked.name,
        character_id: linked.id,
        featured: true
      })
    )
    const res = await $fetch<{ asset: ProjectAsset }>(
      `/api/projects/${target.projectId}/assets/upload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      }
    )
    toast.showToast('Image uploaded.', 'success')
    if (res.asset) {
      try {
        await setFeaturedCharacterImage(res.asset)
      } catch {
        await fetchItems()
      }
    } else {
      await fetchItems()
    }
  } catch (e: unknown) {
    const status =
      e && typeof e === 'object' && 'statusCode' in e
        ? Number((e as { statusCode?: number }).statusCode)
        : 0
    if (status === 413) {
      toast.showToast(
        'Image is too large for the server. We resized it automatically — try again, or use a smaller file.',
        'error'
      )
    } else {
      toast.showToast(formatApiFetchError(e, 'Could not upload image'), 'error')
    }
  } finally {
    uploadingCharacterAssetId.value = ''
  }
}

async function setFeaturedCharacterImage (target: ProjectAsset) {
  if (props.kind !== 'character' || !target.projectId) return
  const token = getAuthToken()
  if (!token) return
  const targetMeta = characterMetaFromAsset(target)
  if (!targetMeta.id && !targetMeta.name) {
    toast.showToast('This image is not linked to a character yet.', 'warning')
    return
  }
  featuringId.value = target.id
  try {
    const peers = items.value.filter((a) => {
      if (a.projectId !== target.projectId) return false
      const m = characterMetaFromAsset(a)
      if (targetMeta.id && m.id) return m.id === targetMeta.id
      return normalizeName(m.name) === normalizeName(targetMeta.name)
    })
    for (const a of peers) {
      if (!isStoredProjectAsset(a)) continue
      const baseMeta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
      await $fetch(`/api/projects/${a.projectId}/assets/${a.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          metadata: {
            ...baseMeta,
            character_id: targetMeta.id || (typeof baseMeta.character_id === 'string' ? baseMeta.character_id : ''),
            character_name: targetMeta.name || (typeof baseMeta.character_name === 'string' ? baseMeta.character_name : ''),
            featured: a.id === target.id
          }
        }
      })
    }
    toast.showToast('Featured image updated.', 'success')
    await fetchItems()
  } catch (e) {
    toast.showToast(formatApiFetchError(e, 'Could not update featured image'), 'error')
  } finally {
    featuringId.value = ''
  }
}

useHead({
  title: `${props.headline} — Assets`
})
</script>
