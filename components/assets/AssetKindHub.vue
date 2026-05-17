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
      <button
        v-if="isAuthenticated"
        type="button"
        class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors"
        @click="openAdd = true"
      >
        Add {{ addButtonLabel }}
      </button>
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

        <template v-if="props.kind === 'video' && videoProjectGroups.length">
          <div
            v-for="g in videoProjectGroups"
            :key="g.key"
            class="mb-8 rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            <div class="px-4 py-3 border-b border-gray-200 bg-gray-50/90 flex flex-wrap items-baseline justify-between gap-2">
              <div class="min-w-0">
                <h2 class="text-sm font-semibold text-gray-900 truncate">
                  {{ g.title }}
                </h2>
                <p v-if="g.subtitle" class="text-xs text-gray-500 mt-0.5">
                  {{ g.subtitle }}
                </p>
              </div>
              <NuxtLink
                v-if="g.projectId && PB_ID.test(g.projectId)"
                :to="`/projects/${g.projectId}/video`"
                class="text-xs font-medium text-primary hover:underline shrink-0"
              >
                Open Video step →
              </NuxtLink>
            </div>
            <ul class="divide-y divide-gray-200">
              <li
                v-for="a in g.items"
                :key="a.id"
                class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
              >
                <div class="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div
                    v-if="a.fileUrl"
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
                    <p v-if="a.notes" class="text-sm text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">{{ a.notes }}</p>
                    <p class="text-xs text-gray-400 mt-2">{{ formatDate(a.updated || a.created) }}</p>
                  </div>
                </div>
                <div class="shrink-0">
                  <details class="relative">
                    <summary
                      class="list-none cursor-pointer select-none inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Actions
                    </summary>
                    <div
                      class="absolute right-0 z-20 mt-2 min-w-[13rem] rounded-lg border border-gray-200 bg-white shadow-lg p-1"
                    >
                      <a
                        v-if="a.fileUrl"
                        :href="videoAssetPlaybackSrc(a)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Download file
                      </a>
                      <NuxtLink
                        v-if="a.projectId"
                        :to="`/projects/${a.projectId}/overview`"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open project
                      </NuxtLink>
                      <NuxtLink
                        v-if="a.projectId && PB_ID.test(a.projectId)"
                        :to="`/projects/${a.projectId}/timeline`"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open timeline
                      </NuxtLink>
                      <button
                        v-if="a.projectId && a.fileUrl"
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                        @click="addVideoAssetToTimeline(a)"
                      >
                        Add to timeline
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
          </div>
        </template>

        <template v-else-if="props.kind === 'character' && characterProjectGroups.length">
          <div
            v-for="g in characterProjectGroups"
            :key="g.key"
            class="mb-8 rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            <div class="px-4 py-3 border-b border-gray-200 bg-gray-50/90 flex flex-wrap items-baseline justify-between gap-2">
              <div class="min-w-0">
                <h2 class="text-sm font-semibold text-gray-900 truncate">
                  {{ g.title }}
                </h2>
                <p v-if="g.subtitle" class="text-xs text-gray-500 mt-0.5">
                  {{ g.subtitle }}
                </p>
              </div>
              <NuxtLink
                v-if="g.projectId && PB_ID.test(g.projectId)"
                :to="`/projects/${g.projectId}/characters`"
                class="text-xs font-medium text-primary hover:underline shrink-0"
              >
                Open Characters step →
              </NuxtLink>
            </div>
            <ul class="divide-y divide-gray-200">
              <li
                v-for="a in g.items"
                :key="a.id"
                class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
              >
                <div class="min-w-0 flex-1 flex items-start gap-3">
                  <div
                    v-if="a.fileUrl"
                    class="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0"
                  >
                    <img
                      :src="a.fileUrl"
                      alt=""
                      class="w-full h-full object-cover"
                      loading="lazy"
                    >
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-gray-900">{{ a.title }}</p>
                    <p
                      v-if="isFeaturedCharacterAsset(a)"
                      class="text-[11px] font-semibold text-emerald-700 mt-0.5"
                    >
                      Featured image
                    </p>
                    <p v-if="scriptSourceLine(a)" class="text-xs font-medium text-primary mt-1">
                      {{ scriptSourceLine(a) }}
                    </p>
                    <p v-if="a.notes" class="text-sm text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">{{ a.notes }}</p>
                    <p class="text-xs text-gray-400 mt-2">{{ formatDate(a.updated || a.created) }}</p>
                  </div>
                </div>
                <div class="shrink-0">
                  <details class="relative">
                    <summary
                      class="list-none cursor-pointer select-none inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Actions
                    </summary>
                    <div
                      class="absolute right-0 z-20 mt-2 min-w-[13rem] rounded-lg border border-gray-200 bg-white shadow-lg p-1"
                    >
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
                        :to="`/projects/${a.projectId}/overview`"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open project
                      </NuxtLink>
                      <NuxtLink
                        :to="characterCreatorTo(a)"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open in Character Creator
                      </NuxtLink>
                      <button
                        v-if="a.projectId && a.fileUrl"
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
          </div>
        </template>

        <ul
          v-else-if="visibleItems.length && props.kind !== 'video'"
          class="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white overflow-hidden"
        >
          <li
            v-for="a in visibleItems"
            :key="a.id"
            class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
          >
            <div class="min-w-0 flex-1 flex items-start gap-3">
              <div
                v-if="props.kind === 'character' && a.fileUrl"
                class="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0"
              >
                <img
                  :src="a.fileUrl"
                  alt=""
                  class="w-full h-full object-cover"
                  loading="lazy"
                >
              </div>
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
              <details class="relative">
                <summary
                  class="list-none cursor-pointer select-none inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Actions
                </summary>
                <div
                  class="absolute right-0 z-20 mt-2 min-w-[13rem] rounded-lg border border-gray-200 bg-white shadow-lg p-1"
                >
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
                    :to="`/projects/${a.projectId}/overview`"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                  >
                    Open project
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

    <Teleport to="body">
      <div
        v-if="openAdd"
        class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="modalTitleId"
        @click.self="closeAdd"
      >
        <div
          class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto"
          @click.stop
        >
          <h2 :id="modalTitleId" class="text-lg font-semibold text-gray-900 mb-4">
            Add {{ addButtonLabel }}
          </h2>
          <p v-if="!pbProjects.length" class="text-sm text-amber-800 mb-4">
            You need at least one project saved to your account. Create or import a project first.
          </p>
          <form v-else class="space-y-4" @submit.prevent="submitAdd">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="asset-project">Project</label>
              <select
                id="asset-project"
                v-model="addForm.projectId"
                required
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
              >
                <option value="" disabled>Select project</option>
                <option v-for="p in pbProjects" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="asset-title">Title</label>
              <input
                id="asset-title"
                v-model="addForm.title"
                type="text"
                required
                maxlength="500"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
                placeholder="e.g. Draft v2, Reference sheet"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="asset-notes">Notes (optional)</label>
              <textarea
                id="asset-notes"
                v-model="addForm.notes"
                rows="4"
                maxlength="20000"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm resize-y"
                placeholder="Description, links, or paste text…"
              />
            </div>
            <p v-if="addError" class="text-sm text-red-700">{{ addError }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                @click="closeAdd"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm disabled:opacity-50"
                :disabled="adding"
              >
                {{ adding ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import type { ProjectAsset, ProjectAssetKind } from '~/types/project-asset'
import type { CreativeProject } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

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
const route = useRoute()

const loading = ref(true)
const loadError = ref('')
const items = ref<ProjectAsset[]>([])
const openAdd = ref(false)
const adding = ref(false)
const addError = ref('')
const deletingId = ref('')
const featuringId = ref('')

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

function videoAssetPlaybackSrc (a: ProjectAsset): string {
  void authTokenState.value
  if (props.kind !== 'video' || !a.id || !a.projectId) {
    return (a.fileUrl || '').trim()
  }
  return appendPlaybackAccessToken(projectAssetMediaPath(a.projectId, a.id), getAuthToken())
}

/** Where a script file came from + whether AI import was run (scripts hub only). */
function scriptSourceLine (a: ProjectAsset): string {
  if (props.kind !== 'script') return ''
  const meta = a.metadata
  if (!meta || typeof meta !== 'object') return ''
  const source = typeof meta.source === 'string' ? meta.source : ''
  const analysisStatus = typeof meta.analysis_status === 'string' ? meta.analysis_status : ''

  if (source === 'script_import') {
    if (analysisStatus === 'pending') {
      return 'Saved from a project · run director analysis on Overview when ready'
    }
    if (analysisStatus === 'director_ready') {
      return 'Director analysis done · generate scenes on Scenes, cast on Characters, panels on Storyboard'
    }
    if (analysisStatus === 'complete') {
      return 'Saved from a project · scene breakdown saved (full workflow)'
    }
    return 'Saved from a project'
  }
  if (source === 'script_wizard_upload') {
    return 'Script Wizard'
  }
  return ''
}

function firstQueryString (v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return ''
}

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

function characterMetaFromAsset (a: ProjectAsset): { id: string; name: string } {
  const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
  const id = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
  const name = typeof meta.character_name === 'string' ? meta.character_name.trim() : ''
  if (name) return { id, name }
  const baseTitle = (a.title || '').split('—')[0]?.trim() || ''
  return { id, name: baseTitle }
}

function characterDedupeKey (a: ProjectAsset): string {
  const pid = (a.projectId && PB_ID.test(a.projectId)) ? a.projectId : ''
  const projectPrefix = pid ? `p:${pid}:` : 'p:__none__:'
  const m = characterMetaFromAsset(a)
  if (m.id && PB_ID.test(m.id)) return `${projectPrefix}id:${m.id}`
  const n = normalizeName(m.name)
  if (n) return `${projectPrefix}name:${n}`
  // Last resort: keep each row distinct
  return `${projectPrefix}asset:${a.id}`
}

function isFeaturedCharacterAsset (a: ProjectAsset): boolean {
  const meta = a.metadata
  return !!(meta && typeof meta === 'object' && meta.featured === true)
}

function characterAssetRank (a: ProjectAsset): number {
  let score = 0
  if (a.fileUrl) score += 1_000_000
  if (isFeaturedCharacterAsset(a)) score += 500_000
  const ts = (a.updated || a.created || '').trim()
  // ISO strings sort lexicographically; missing dates sink to bottom within same bucket.
  for (let i = 0; i < ts.length; i++) score += ts.charCodeAt(i)
  return score
}

function dedupeCharacterAssets (list: ProjectAsset[]): ProjectAsset[] {
  if (props.kind !== 'character') return list
  const best = new Map<string, ProjectAsset>()
  for (const a of list) {
    const k = characterDedupeKey(a)
    const prev = best.get(k)
    if (!prev) {
      best.set(k, a)
      continue
    }
    if (characterAssetRank(a) > characterAssetRank(prev)) best.set(k, a)
  }
  return [...best.values()]
}

function characterCreatorTo (a: ProjectAsset) {
  const m = characterMetaFromAsset(a)
  const q: Record<string, string> = {
    name: (m.name || (a.title || '').split('—')[0]?.trim() || a.title || '').slice(0, 200),
    description: (a.notes || '').slice(0, 4000)
  }
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
    return dedupeCharacterAssets(out)
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
  return dedupeCharacterAssets(filtered)
})

type AssetProjectGroup = {
  key: string
  projectId: string
  title: string
  subtitle: string
  items: ProjectAsset[]
}

function sortCharacterAssetsForDisplay (list: ProjectAsset[]): ProjectAsset[] {
  return [...list].sort((a, b) => {
    const af = isFeaturedCharacterAsset(a) ? 1 : 0
    const bf = isFeaturedCharacterAsset(b) ? 1 : 0
    if (bf !== af) return bf - af
    const ta = a.updated || a.created || ''
    const tb = b.updated || b.created || ''
    return tb.localeCompare(ta)
  })
}

function buildProjectAssetGroups (
  list: ProjectAsset[],
  sortItems: (rows: ProjectAsset[]) => ProjectAsset[]
): AssetProjectGroup[] {
  const byPid = new Map<string, ProjectAsset[]>()
  for (const a of list) {
    const pid = (a.projectId && PB_ID.test(a.projectId)) ? a.projectId : ''
    const key = pid || '__unassigned__'
    const cur = byPid.get(key) || []
    cur.push(a)
    byPid.set(key, cur)
  }
  const groups: AssetProjectGroup[] = []
  for (const [key, raw] of byPid.entries()) {
    const pid = key === '__unassigned__' ? '' : key
    const nameFromAsset = raw.find(a => a.projectName)?.projectName?.trim() || ''
    const nameFromStore =
      pid ? (projects.value.find(p => p.id === pid)?.name || '').trim() : ''
    const projectName = nameFromAsset || nameFromStore || (pid ? 'Project' : '')
    const title = pid ? projectName || 'Project' : 'No project assigned'
    const subtitle = pid ? `Project id: ${pid}` : 'These entries are not linked to a PocketBase project id.'
    groups.push({
      key,
      projectId: pid,
      title,
      subtitle,
      items: sortItems(raw)
    })
  }
  groups.sort((a, b) => {
    if (!a.projectId && b.projectId) return 1
    if (!b.projectId && a.projectId) return -1
    return a.title.localeCompare(b.title)
  })
  return groups
}

function sortVideoAssetsForDisplay (list: ProjectAsset[]): ProjectAsset[] {
  return [...list].sort((a, b) =>
    String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || ''))
  )
}

const characterProjectGroups = computed<AssetProjectGroup[]>(() => {
  if (props.kind !== 'character') return []
  return buildProjectAssetGroups(visibleItems.value, sortCharacterAssetsForDisplay)
})

const videoProjectGroups = computed<AssetProjectGroup[]>(() => {
  if (props.kind !== 'video') return []
  return buildProjectAssetGroups(visibleItems.value, sortVideoAssetsForDisplay)
})

function addVideoAssetToTimeline (a: ProjectAsset) {
  if (!a.projectId || !PB_ID.test(a.projectId) || !a.id) return
  const src = videoAssetPlaybackSrc(a)
  if (!src) return
  const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
  const sceneId = typeof meta.scene_id === 'string' ? meta.scene_id : undefined
  const shotId = typeof meta.shot_id === 'string' ? meta.shot_id : undefined
  const { addVideoClip } = useProjectTimeline(computed(() => a.projectId))
  addVideoClip({
    url: src,
    label: (a.title || 'Video clip').slice(0, 500),
    sceneId,
    shotId
  })
  toast.showToast('Added to project timeline.', 'success')
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
