<template>
  <div :class="compact ? 'space-y-2' : 'space-y-4'">
    <div
      v-if="!compact"
      class="flex flex-wrap items-start justify-between gap-3"
    >
      <div>
        <h2 class="text-base font-semibold text-gray-900">Generated videos</h2>
        <p class="text-sm text-gray-600 mt-1">
          All clips saved to this project. Drag to reorder — order is saved to the library.
          Edit reopens the full prompt in Video generation.
        </p>
      </div>
      <button
        type="button"
        class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-studio-slate hover:bg-gray-50 text-gray-800 disabled:opacity-50"
        :disabled="loading || reordering || busyId !== ''"
        @click="reload"
      >
        Refresh
      </button>
    </div>

    <p v-if="!isAuthenticated" class="text-sm text-amber-800">
      <NuxtLink to="/login" class="text-primary font-medium underline">Log in</NuxtLink>
      to browse project clips.
    </p>
    <p v-else-if="loading" class="text-sm text-gray-600">Loading videos…</p>
    <p v-else-if="error" class="text-sm text-red-700">{{ error }}</p>
    <p
      v-else-if="!items.length"
      class="text-sm text-gray-600"
      :class="compact ? 'text-xs' : ''"
    >
      No generated videos yet. Create clips from Storyboard or Tools → Video generation.
    </p>

    <ul
      v-else
      class="space-y-2"
      :class="compact ? 'max-h-56 overflow-y-auto' : ''"
    >
      <li
        v-for="(a, index) in items"
        :key="a.id"
        draggable="true"
        class="rounded-lg border border-gray-200 bg-studio-slate transition-opacity"
        :class="[
          compact ? 'px-2.5 py-2' : 'px-3 py-3',
          draggingId === a.id ? 'opacity-50' : '',
          dropIndex === index ? 'ring-2 ring-primary/40' : ''
        ]"
        @dragstart="onDragStart(a.id, $event)"
        @dragend="onDragEnd"
        @dragover="onDragOver(index, $event)"
        @dragleave="onDragLeave(index)"
        @drop="onDrop(index, $event)"
      >
        <div class="flex items-start gap-2 sm:gap-3">
          <span
            class="shrink-0 mt-1 text-gray-400 cursor-grab active:cursor-grabbing select-none"
            title="Drag to reorder"
            aria-hidden="true"
          >
            ⋮⋮
          </span>
          <LazyAssetVideo
            v-if="!compact && a.fileUrl"
            :src="videoSrc(a)"
            class="!max-w-[11rem]"
          />
          <div class="min-w-0 flex-1">
            <p
              class="font-medium text-gray-900 truncate"
              :class="compact ? 'text-xs' : 'text-sm'"
            >
              {{ a.title || 'Untitled clip' }}
            </p>
            <p
              v-if="!compact && promptPreview(a)"
              class="text-sm text-gray-600 mt-1 line-clamp-2 whitespace-pre-wrap"
            >
              {{ promptPreview(a) }}
            </p>
            <p class="text-[11px] text-gray-500 mt-1">
              {{ formatDate(a.updated || a.created) }}
              <span v-if="reordering && draggingId === a.id"> · Saving…</span>
            </p>
          </div>
          <div
            class="shrink-0 flex flex-col items-end gap-1"
            @click.stop
            @mousedown.stop
          >
            <a
              v-if="a.fileUrl"
              :href="videoSrc(a)"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[11px] font-medium text-primary hover:underline"
            >
              Open
            </a>
            <button
              v-if="!compact"
              type="button"
              class="text-[11px] font-medium text-primary hover:underline disabled:opacity-40"
              :disabled="busyId === a.id"
              @click="editClip(a)"
            >
              Edit
            </button>
            <button
              v-if="!compact && a.fileUrl"
              type="button"
              class="text-[11px] font-medium text-gray-700 hover:underline disabled:opacity-40"
              :disabled="busyId === a.id"
              @click="downloadClip(a)"
            >
              {{ busyId === a.id && busyAction === 'download' ? '…' : 'Download' }}
            </button>
            <button
              v-if="!compact"
              type="button"
              class="text-[11px] font-medium text-red-700 hover:underline disabled:opacity-40"
              :disabled="busyId === a.id"
              @click="deleteClip(a)"
            >
              {{ busyId === a.id && busyAction === 'delete' ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </div>
      </li>
      <li
        class="h-2"
        :class="dropIndex === items.length ? 'ring-2 ring-primary/40 rounded' : ''"
        @dragover="onDragOver(items.length, $event)"
        @dragleave="onDragLeave(items.length)"
        @drop="onDrop(items.length, $event)"
      />
    </ul>
  </div>
</template>

<script setup lang="ts">
import LazyAssetVideo from '~/components/assets/LazyAssetVideo.vue'
import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { downloadMediaFile, sanitizeDownloadFilename } from '~/lib/download-media-file'
import {
  resolveVideoAssetPrompt,
  videoAssetToGenerationPrefill
} from '~/lib/video-asset-regeneration'
import { navigateToVideoGenerationFromAsset } from '~/lib/video-generation-prefill'
import type { ProjectAsset } from '~/types/project-asset'

const props = withDefaults(
  defineProps<{
    projectId: string
    compact?: boolean
  }>(),
  { compact: false }
)

const emit = defineEmits<{
  'update:count': [count: number]
}>()

const { isAuthenticated, getAuthToken, initAuth } = useAuth()
const authTokenState = useState<string | null>('auth_token')
const toast = useToast()

const loading = ref(false)
const reordering = ref(false)
const error = ref('')
const items = ref<ProjectAsset[]>([])
const draggingId = ref<string | null>(null)
const dropIndex = ref<number | null>(null)
const busyId = ref('')
const busyAction = ref<'delete' | 'download' | ''>('')

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
  const token = getAuthToken()
  if (a.projectId && a.id) {
    return appendPlaybackAccessToken(projectAssetMediaPath(a.projectId, a.id), token)
  }
  return a.fileUrl || ''
}

function promptPreview (a: ProjectAsset): string {
  const { prompt } = resolveVideoAssetPrompt(a)
  if (prompt) return prompt
  return (a.notes || '').trim()
}

function sortVideos (list: ProjectAsset[]): ProjectAsset[] {
  return [...list].sort((a, b) => {
    const ao = Number.isFinite(a.sortOrder) ? a.sortOrder : 0
    const bo = Number.isFinite(b.sortOrder) ? b.sortOrder : 0
    if (ao !== bo) return ao - bo
    return (b.created || '').localeCompare(a.created || '')
  })
}

async function reload () {
  error.value = ''
  items.value = []
  emit('update:count', 0)
  if (!props.projectId || !isAuthenticated.value) return
  const token = getAuthToken()
  if (!token) return

  loading.value = true
  try {
    const res = await $fetch<{ items: ProjectAsset[] }>(
      `/api/projects/${props.projectId}/assets`,
      {
        query: { kind: 'video' },
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    items.value = sortVideos(res.items || [])
    emit('update:count', items.value.length)
  } catch (e: unknown) {
    error.value = formatApiFetchError(e, 'Could not load videos')
  } finally {
    loading.value = false
  }
}

function onDragStart (id: string, ev: DragEvent) {
  draggingId.value = id
  dropIndex.value = null
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', id)
  }
}

function onDragEnd () {
  draggingId.value = null
  dropIndex.value = null
}

function onDragOver (index: number, ev: DragEvent) {
  if (!draggingId.value) return
  ev.preventDefault()
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
  dropIndex.value = index
}

function onDragLeave (index: number) {
  if (dropIndex.value === index) dropIndex.value = null
}

function reorderLocally (fromIndex: number, toIndex: number): ProjectAsset[] | null {
  if (fromIndex < 0 || toIndex < 0) return null
  const list = [...items.value]
  if (fromIndex >= list.length || toIndex > list.length) return null
  const [moved] = list.splice(fromIndex, 1)
  if (!moved) return null
  let insertAt = toIndex
  if (fromIndex < toIndex) insertAt = toIndex - 1
  if (insertAt === fromIndex) return null
  list.splice(insertAt, 0, moved)
  return list.map((a, i) => ({ ...a, sortOrder: i }))
}

async function persistOrder (ordered: ProjectAsset[]) {
  const token = getAuthToken()
  if (!token || !props.projectId) return false
  reordering.value = true
  try {
    await Promise.all(
      ordered.map((a, i) =>
        $fetch(`/api/projects/${props.projectId}/assets/${a.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: { sort_order: i }
        })
      )
    )
    return true
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not save video order'), 'error')
    return false
  } finally {
    reordering.value = false
  }
}

async function onDrop (toIndex: number, ev: DragEvent) {
  ev.preventDefault()
  const id = draggingId.value || ev.dataTransfer?.getData('text/plain') || ''
  draggingId.value = null
  dropIndex.value = null
  if (!id) return
  const fromIndex = items.value.findIndex((a) => a.id === id)
  if (fromIndex < 0) return
  const previous = items.value
  const next = reorderLocally(fromIndex, toIndex)
  if (!next) return
  items.value = next
  const ok = await persistOrder(next)
  if (!ok) items.value = previous
}

async function editClip (a: ProjectAsset) {
  if (!props.projectId) return
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Sign in to edit clips.', 'error')
    return
  }

  busyId.value = a.id
  try {
    // Fetch full asset so regeneration_prompt / frames are not stale from the list.
    const res = await $fetch<{ asset?: ProjectAsset }>(
      `/api/projects/${props.projectId}/assets/${a.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const asset = res.asset || a
    const { prompt, truncated } = resolveVideoAssetPrompt(asset)
    if (!prompt.trim()) {
      toast.showToast('This clip has no saved prompt — open Video generation and start fresh.', 'warning')
      return
    }
    if (truncated) {
      toast.showToast(
        'Older clip — only a short title was saved. Review and expand the prompt before regenerating.',
        'info'
      )
    }
    await navigateToVideoGenerationFromAsset({
      projectId: props.projectId,
      prefill: videoAssetToGenerationPrefill(asset, props.projectId)
    })
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not open clip for edit'), 'error')
  } finally {
    busyId.value = ''
  }
}

async function downloadClip (a: ProjectAsset) {
  if (!a.fileUrl || busyId.value) return
  busyId.value = a.id
  busyAction.value = 'download'
  try {
    const token = getAuthToken()
    await downloadMediaFile({
      url: videoSrc(a),
      filename: sanitizeDownloadFilename(a.title || 'clip'),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    })
    toast.showToast('Download started.', 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not download clip'), 'error')
  } finally {
    busyId.value = ''
    busyAction.value = ''
  }
}

async function deleteClip (a: ProjectAsset) {
  if (!props.projectId || busyId.value) return
  if (!confirm(`Delete “${a.title || 'this clip'}” from the project? This cannot be undone.`)) return
  const token = getAuthToken()
  if (!token) return
  busyId.value = a.id
  busyAction.value = 'delete'
  try {
    await $fetch(`/api/projects/${props.projectId}/assets/${a.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    items.value = items.value.filter((x) => x.id !== a.id)
    emit('update:count', items.value.length)
    toast.showToast('Clip deleted.', 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not delete clip'), 'error')
  } finally {
    busyId.value = ''
    busyAction.value = ''
  }
}

watch(
  () => [props.projectId, isAuthenticated.value] as const,
  () => {
    void reload()
  },
  { immediate: true }
)

onMounted(() => {
  void initAuth()
})

defineExpose({ reload, count: computed(() => items.value.length) })
</script>
