<template>
  <div class="max-w-6xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
      · Drag a clip onto another row to reorder within that track. Stored in this browser only (localStorage).
    </p>

    <div class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-6">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 class="text-lg font-semibold text-gray-900">
            Timeline
          </h1>
          <p class="text-sm text-gray-600 mt-1 max-w-2xl">
            Project <span class="font-medium text-gray-800">{{ project?.name }}</span>.
            A simple two-track layout (Premiere-style, scaled down): video above, audio below.
          </p>
        </div>
        <NuxtLink
          :to="`/projects/${projectId}/video`"
          class="text-sm font-medium text-primary hover:underline"
        >
          ← Back to Video
        </NuxtLink>
      </div>

      <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
        <p class="text-xs font-medium text-gray-600 mb-2">
          Sequence preview (video track, left → right)
        </p>
        <video
          v-if="previewUrl"
          ref="previewEl"
          :key="previewUrl"
          :src="playbackVideoSrc(previewUrl)"
          class="w-full max-h-[42vh] rounded-lg border border-gray-200 bg-black"
          controls
          playsinline
          @ended="onPreviewEnded"
        />
        <p v-else class="text-sm text-gray-500 py-6 text-center">
          Add video clips from the Video page, then use “Play all” below.
        </p>
        <div v-if="state.video.length" class="mt-3 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-gray-950 hover:bg-primary/90"
            @click="playSequenceFrom(0)"
          >
            Play all (video track)
          </button>
          <span class="text-xs text-gray-500">
            {{ state.video.length }} video · {{ state.audio.length }} audio
          </span>
        </div>
      </div>

      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-900 mb-2">
          Video track
        </h2>
        <p class="text-xs text-gray-500 mb-3">
          Drag the handle (⋮) or the row onto another row to reorder.
        </p>
        <ul class="space-y-2 rounded-lg border border-dashed border-gray-300 bg-white p-2">
          <li
            v-for="(clip, idx) in state.video"
            :key="clip.id"
            draggable="true"
            class="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 cursor-grab active:cursor-grabbing"
            @dragstart="onDragStart('video', idx)"
            @dragover.prevent
            @drop.prevent="onDropRow('video', idx)"
          >
            <span class="text-gray-400 select-none" aria-hidden="true">⋮⋮</span>
            <span class="text-xs font-mono text-primary w-6">{{ idx + 1 }}</span>
            <span class="text-sm text-gray-900 flex-1 min-w-0 truncate">{{ clip.label }}</span>
            <button
              type="button"
              class="text-xs text-primary hover:underline"
              @click.stop="previewUrl = clip.url"
            >
              Preview
            </button>
            <button
              type="button"
              class="text-xs text-red-600 hover:underline"
              @click.stop="removeVideoClip(clip.id)"
            >
              Remove
            </button>
          </li>
        </ul>
      </section>

      <section>
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 class="text-sm font-semibold text-gray-900">
            Audio track
          </h2>
          <label class="text-xs font-medium text-primary cursor-pointer hover:underline">
            <input
              type="file"
              accept="audio/*"
              class="sr-only"
              @change="onAudioFile"
            >
            Add audio file
          </label>
        </div>
        <p class="text-xs text-gray-500 mb-3">
          Uploads use temporary blob URLs for this session; they are not durable across browsers or devices.
        </p>
        <ul class="space-y-2 rounded-lg border border-dashed border-gray-300 bg-white p-2">
          <li
            v-for="(clip, idx) in state.audio"
            :key="clip.id"
            draggable="true"
            class="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 cursor-grab active:cursor-grabbing"
            @dragstart="onDragStart('audio', idx)"
            @dragover.prevent
            @drop.prevent="onDropRow('audio', idx)"
          >
            <span class="text-gray-400 select-none" aria-hidden="true">⋮⋮</span>
            <span class="text-xs font-mono text-primary w-6">{{ idx + 1 }}</span>
            <span class="text-sm text-gray-900 flex-1 min-w-0 truncate">{{ clip.label }}</span>
            <audio :src="clip.url" controls class="max-w-[220px] h-8" />
            <button
              type="button"
              class="text-xs text-red-600 hover:underline"
              @click.stop="removeAudioClip(clip.id)"
            >
              Remove
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { appendPlaybackAccessToken } from '~/lib/project-asset-playback-url'

const { activeProject, activeProjectId } = useCreativeProject()
const { stepBadge } = useProjectWorkflowStep()
const toast = useToast()
const { getAuthToken } = useAuth()
const authTokenState = useState<string | null>('auth_token')

function playbackVideoSrc (raw: string | undefined): string {
  void authTokenState.value
  const u = (raw || '').trim()
  if (!u) return ''
  return appendPlaybackAccessToken(u, getAuthToken())
}

const projectId = activeProjectId
const project = activeProject

const {
  state,
  addAudioClip,
  removeVideoClip,
  removeAudioClip,
  reorderVideo,
  reorderAudio
} = useProjectTimeline(projectId)

const previewEl = ref<HTMLVideoElement | null>(null)
const previewUrl = ref('')
const seqIndex = ref(0)

const dragKind = ref<'video' | 'audio' | null>(null)
const dragFrom = ref<number | null>(null)

function onDragStart (kind: 'video' | 'audio', index: number) {
  dragKind.value = kind
  dragFrom.value = index
}

function onDropRow (kind: 'video' | 'audio', toIndex: number) {
  const from = dragFrom.value
  const k = dragKind.value
  if (from === null || k !== kind) return
  if (kind === 'video') reorderVideo(from, toIndex)
  else reorderAudio(from, toIndex)
  dragFrom.value = null
  dragKind.value = null
}

function playSequenceFrom (startIdx: number) {
  const v = state.video[startIdx]
  if (!v?.url) {
    toast.showToast('No video clip at that position.', 'info')
    return
  }
  seqIndex.value = startIdx
  previewUrl.value = v.url
  nextTick(() => previewEl.value?.play().catch(() => {}))
}

function onPreviewEnded () {
  const next = seqIndex.value + 1
  if (next < state.video.length) {
    playSequenceFrom(next)
  }
}

function onAudioFile (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const url = URL.createObjectURL(file)
  addAudioClip({ label: file.name || 'Audio clip', url })
  toast.showToast('Audio added.', 'success')
}
</script>
