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

        <ul
          v-else-if="items.length"
          class="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white overflow-hidden"
        >
          <li
            v-for="a in items"
            :key="a.id"
            class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium text-gray-900">{{ a.title }}</p>
              <p v-if="scriptSourceLine(a)" class="text-xs font-medium text-primary mt-1">
                {{ scriptSourceLine(a) }}
              </p>
              <p v-if="a.projectName" class="text-xs text-gray-500 mt-0.5">Project: {{ a.projectName }}</p>
              <p v-if="a.notes" class="text-sm text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">{{ a.notes }}</p>
              <p class="text-xs text-gray-400 mt-2">{{ formatDate(a.updated || a.created) }}</p>
            </div>
            <div class="flex flex-wrap gap-2 shrink-0">
              <a
                v-if="a.fileUrl"
                :href="a.fileUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm font-medium text-primary hover:underline"
              >
                Download file
              </a>
              <NuxtLink
                v-if="a.projectId"
                :to="`/projects/${a.projectId}/overview`"
                class="text-sm font-medium text-primary hover:underline"
              >
                Open project
              </NuxtLink>
              <button
                type="button"
                class="text-sm font-medium text-red-700 hover:underline"
                :disabled="deletingId === a.id"
                @click="removeAsset(a)"
              >
                {{ deletingId === a.id ? 'Removing…' : 'Remove' }}
              </button>
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
const { projects, loadServerProjects, clientReady } = useCreativeProject()
const toast = useToast()

const loading = ref(true)
const loadError = ref('')
const items = ref<ProjectAsset[]>([])
const openAdd = ref(false)
const adding = ref(false)
const addError = ref('')
const deletingId = ref('')

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

/** Where a script file came from + whether AI import was run (scripts hub only). */
function scriptSourceLine (a: ProjectAsset): string {
  if (props.kind !== 'script') return ''
  const meta = a.metadata
  if (!meta || typeof meta !== 'object') return ''
  const source = typeof meta.source === 'string' ? meta.source : ''
  const analysisStatus = typeof meta.analysis_status === 'string' ? meta.analysis_status : ''

  if (source === 'script_import') {
    if (analysisStatus === 'pending') {
      return 'Saved from a project · run “treatment & scene import” on Overview when ready'
    }
    if (analysisStatus === 'complete') {
      return 'Saved from a project · AI import complete'
    }
    return 'Saved from a project'
  }
  if (source === 'script_wizard_upload') {
    return 'Script Wizard'
  }
  return ''
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
    if (a.projectId) {
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

useHead({
  title: `${props.headline} — Assets`
})
</script>
