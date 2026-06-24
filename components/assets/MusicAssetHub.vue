<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <nav class="text-sm text-gray-500 mb-6">
      <NuxtLink to="/assets" class="hover:text-primary">Assets</NuxtLink>
      <span class="mx-2" aria-hidden="true">/</span>
      <span class="text-gray-900">My Music</span>
    </nav>

    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">My Music</h1>
    <p class="text-gray-600 text-sm sm:text-base mb-6 max-w-2xl">
      AI-generated scores and uploaded tracks saved to your projects — ready to drop on the timeline.
    </p>

    <div class="flex flex-wrap gap-2 mb-8">
      <NuxtLink
        to="/tools/music-generation"
        class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-gray-950 transition-colors"
      >
        Generate music
      </NuxtLink>
      <NuxtLink
        to="/projects"
        class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors"
      >
        Open projects
      </NuxtLink>
      <button
        v-if="isAuthenticated"
        type="button"
        class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors"
        @click="openUpload = true"
      >
        Upload track
      </button>
    </div>

    <ClientOnly>
      <div v-if="!isAuthenticated" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Sign in to see your music library and upload tracks.
      </div>

      <template v-else>
        <p v-if="loadError" class="text-sm text-red-700 mb-4">{{ loadError }}</p>
        <p v-else-if="loading" class="text-sm text-gray-600 mb-4">Loading…</p>

        <template v-else-if="projectGroups.length">
          <details
            v-for="g in projectGroups"
            :key="g.key"
            class="mb-4 rounded-xl border border-gray-200 bg-white group overflow-visible"
          >
            <summary
              class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-4 py-3 bg-gray-50/90 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-100/80 border-b border-transparent group-open:border-gray-200"
            >
              <div class="flex items-start gap-2 min-w-0 flex-1">
                <span
                  class="text-gray-400 text-xs shrink-0 mt-0.5 transition-transform group-open:rotate-90"
                  aria-hidden="true"
                >▶</span>
                <div class="min-w-0">
                  <h2 class="text-sm font-semibold text-gray-900 truncate">
                    {{ g.projectName }}
                  </h2>
                  <p class="text-xs text-gray-500 mt-0.5">
                    {{ g.items.length }} track{{ g.items.length === 1 ? '' : 's' }}
                  </p>
                </div>
              </div>
              <NuxtLink
                v-if="g.projectId && PB_ID.test(g.projectId)"
                :to="`/projects/${g.projectId}/video`"
                class="text-xs font-medium text-primary hover:underline shrink-0"
                @click.stop
              >
                Open timeline →
              </NuxtLink>
            </summary>
            <ul class="divide-y divide-gray-200">
              <li
                v-for="a in g.items"
                :key="a.id"
                class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
              >
                <div class="min-w-0 flex-1 space-y-2">
                  <p class="font-medium text-gray-900">{{ a.title }}</p>
                  <p
                    v-if="musicSourceLabel(a)"
                    class="text-xs font-medium text-primary"
                  >
                    {{ musicSourceLabel(a) }}
                  </p>
                  <audio
                    v-if="playbackSrc(a)"
                    :src="playbackSrc(a)"
                    controls
                    preload="metadata"
                    class="w-full max-w-md h-9"
                  />
                  <p v-if="a.notes" class="text-sm text-gray-600 line-clamp-2 whitespace-pre-wrap">{{ a.notes }}</p>
                  <p class="text-xs text-gray-400">{{ formatDate(a.updated || a.created) }}</p>
                </div>
                <div class="shrink-0">
                  <details class="relative open:z-30">
                    <summary
                      class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Actions
                    </summary>
                    <div class="absolute right-0 bottom-full mb-2 z-50 min-w-[13rem] rounded-lg border border-gray-200 bg-white shadow-lg p-1">
                      <button
                        v-if="a.projectId && playbackSrc(a)"
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                        @click="addToTimeline(a)"
                      >
                        Add to timeline
                      </button>
                      <a
                        v-if="playbackSrc(a)"
                        :href="playbackSrc(a)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Download
                      </a>
                      <NuxtLink
                        v-if="a.projectId"
                        :to="`/projects/${a.projectId}/overview`"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open project
                      </NuxtLink>
                      <button
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        :disabled="deletingId === a.id"
                        @click="removeTrack(a)"
                      >
                        {{ deletingId === a.id ? 'Removing…' : 'Remove' }}
                      </button>
                    </div>
                  </details>
                </div>
              </li>
            </ul>
          </details>
        </template>

        <div
          v-else
          class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center"
        >
          <p class="text-gray-700 text-sm mb-2">No music saved yet.</p>
          <p class="text-gray-500 text-sm mb-4">
            Generate a track in Tools → Music generation (save to a project), or upload an MP3 here.
          </p>
          <NuxtLink
            to="/tools/music-generation"
            class="inline-flex text-sm font-medium text-primary hover:underline"
          >
            Generate music →
          </NuxtLink>
        </div>
      </template>
    </ClientOnly>

    <Teleport to="body">
      <div
        v-if="openUpload"
        class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="music-upload-title"
        @click.self="closeUpload"
      >
        <div
          class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto"
          @click.stop
        >
          <h2 id="music-upload-title" class="text-lg font-semibold text-gray-900 mb-4">
            Upload track
          </h2>
          <p v-if="!pbProjects.length" class="text-sm text-amber-800 mb-4">
            Create a project first, then upload music into that project’s library.
          </p>
          <form v-else class="space-y-4" @submit.prevent="submitUpload">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="music-project">Project</label>
              <select
                id="music-project"
                v-model="uploadForm.projectId"
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
              <label class="block text-sm font-medium text-gray-700 mb-1" for="music-title">Title</label>
              <input
                id="music-title"
                v-model="uploadForm.title"
                type="text"
                required
                maxlength="500"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
                placeholder="e.g. Main theme, Act 2 underscore"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="music-file">Audio file</label>
              <input
                id="music-file"
                ref="fileInput"
                type="file"
                required
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                class="w-full text-sm text-gray-700"
                @change="onFilePicked"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="music-notes">Notes (optional)</label>
              <textarea
                id="music-notes"
                v-model="uploadForm.notes"
                rows="2"
                maxlength="20000"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm resize-y"
                placeholder="Mood, BPM, where it goes in the cut…"
              />
            </div>
            <p v-if="uploadError" class="text-sm text-red-700">{{ uploadError }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                :disabled="uploading"
                @click="closeUpload"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm disabled:opacity-50"
                :disabled="uploading || !uploadForm.file"
              >
                {{ uploading ? 'Uploading…' : 'Save to My Music' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { appendAudioToProjectTimeline } from '~/lib/append-project-timeline-audio'
import { groupProjectAssetsByProject } from '~/lib/project-asset-sort'
import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import { uploadMusicTrack, validateMusicTrackFile } from '~/lib/upload-music-track'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import type { ProjectAsset } from '~/types/project-asset'
import type { CreativeProject } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

const { isAuthenticated, initAuth, getAuthToken } = useAuth()
const authTokenState = useState<string | null>('auth_token')
const { projects, loadServerProjects, clientReady } = useCreativeProject()
const toast = useToast()

const loading = ref(true)
const loadError = ref('')
const items = ref<ProjectAsset[]>([])
const deletingId = ref('')
const openUpload = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const uploadForm = reactive({
  projectId: '',
  title: '',
  notes: '',
  file: null as File | null
})

const pbProjects = computed(() =>
  projects.value.filter((p: CreativeProject) => PB_ID.test(p.id))
)

const projectGroups = computed(() => groupProjectAssetsByProject(items.value))

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

function playbackSrc (a: ProjectAsset): string {
  void authTokenState.value
  if (!a.id || !a.projectId || !PB_ID.test(a.projectId)) {
    return (a.fileUrl || '').trim()
  }
  return appendPlaybackAccessToken(projectAssetMediaPath(a.projectId, a.id), getAuthToken())
}

function musicSourceLabel (a: ProjectAsset): string {
  const meta = a.metadata
  if (!meta || typeof meta !== 'object') return ''
  const source = typeof meta.source === 'string' ? meta.source : ''
  if (source === 'music_generation') return 'AI generated'
  if (source === 'music_upload') return 'Uploaded'
  return ''
}

function addToTimeline (a: ProjectAsset) {
  if (!a.projectId || !PB_ID.test(a.projectId)) return
  const src = playbackSrc(a)
  if (!src) return
  appendAudioToProjectTimeline(a.projectId, {
    url: src,
    label: (a.title || 'Music').slice(0, 500),
    duration: 120
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
    const res = await $fetch<{ items: ProjectAsset[] }>('/api/assets/my?kind=music', {
      headers: { Authorization: `Bearer ${token}` }
    })
    items.value = res.items ?? []
  } catch (e) {
    loadError.value = formatApiFetchError(e, 'Could not load music')
  } finally {
    loading.value = false
  }
}

async function removeTrack (a: ProjectAsset) {
  const token = getAuthToken()
  if (!token || !a.projectId) return
  if (!globalThis.confirm(`Remove “${a.title}” from My Music?`)) return
  deletingId.value = a.id
  try {
    await $fetch(`/api/projects/${a.projectId}/assets/${a.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    toast.showToast('Track removed.', 'success')
    await fetchItems()
  } catch {
    toast.showToast('Could not remove track.', 'error')
  } finally {
    deletingId.value = ''
  }
}

function onFilePicked (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0] || null
  uploadForm.file = file
  if (file && !uploadForm.title.trim()) {
    const base = file.name.replace(/\.[^.]+$/, '').trim()
    if (base) uploadForm.title = base.slice(0, 500)
  }
}

function closeUpload () {
  if (uploading.value) return
  openUpload.value = false
  uploadError.value = ''
  uploadForm.projectId = ''
  uploadForm.title = ''
  uploadForm.notes = ''
  uploadForm.file = null
  if (fileInput.value) fileInput.value.value = ''
}

async function submitUpload () {
  const token = getAuthToken()
  if (!token || !uploadForm.projectId || !uploadForm.file) return
  const validation = validateMusicTrackFile(uploadForm.file)
  if (validation) {
    uploadError.value = validation
    return
  }
  uploading.value = true
  uploadError.value = ''
  try {
    await uploadMusicTrack({
      projectId: uploadForm.projectId,
      title: uploadForm.title.trim(),
      notes: uploadForm.notes.trim(),
      file: uploadForm.file,
      token
    })
    toast.showToast('Track saved to My Music.', 'success')
    closeUpload()
    await fetchItems()
  } catch (e) {
    uploadError.value = formatApiFetchError(e, 'Upload failed')
  } finally {
    uploading.value = false
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

useHead({ title: 'My Music — Assets' })
</script>
