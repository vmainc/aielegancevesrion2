<template>
  <div class="timeline-editor flex flex-col gap-4 text-zinc-100">
    <EditorVideoPreview
      ref="previewRef"
      :has-clips="videoClips.length > 0"
      :playing="isPlaying"
      :scrubbing="isScrubbing"
      :timecode-current="formatTimecode(playhead)"
      :timecode-duration="formatTimecode(duration)"
      :active-label="activeVideoClip?.label"
      :blend-label="blendPreviewLabel"
        @toggle-play="onTogglePlay"
      @stop="onStop"
    >
      <template #extra>
        <label class="text-xs text-primary cursor-pointer hover:underline ml-auto">
          <input type="file" accept="audio/*" class="sr-only" @change="onAudioFile">
          + Audio
        </label>
      </template>
    </EditorVideoPreview>

    <EditorTimelineToolbar
      :active-tool="activeTool"
      :has-selection="!!selectedClipId"
      :can-split="canSplit"
      :can-detach="canDetach"
      :can-blend="canBlend"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :zoom="zoom"
      @set-tool="activeTool = $event"
      @undo="onUndo"
      @redo="onRedo"
      @delete="onRemoveSelected()"
      @split="onSplit"
      @blend="onBlend"
      @detach-audio="detachAudio()"
      @set-transition="applyTransition"
      @set-zoom="setZoom"
    />

    <div class="rounded-xl border border-white/10 bg-zinc-950/90 overflow-hidden">
      <div ref="scrollRef" class="overflow-x-auto overflow-y-hidden custom-scrollbar">
        <div class="relative" :style="{ width: `${96 + laneWidthPx}px`, minWidth: '100%' }">
          <div
            class="flex border-b border-white/10 bg-zinc-900/80 cursor-grab active:cursor-grabbing"
            @pointerdown="onScrubAreaDown"
          >
            <div class="w-24 shrink-0 border-r border-white/5 pointer-events-none" />
            <div class="relative h-7 flex-1" :style="{ width: `${laneWidthPx}px` }">
              <span
                v-for="tick in rulerTicks"
                :key="tick.t"
                class="absolute text-[9px] font-mono text-zinc-500 -translate-x-1/2"
                :style="{ left: `${timeToPx(tick.t, zoom)}px` }"
              >
                {{ tick.label }}
              </span>
            </div>
          </div>

          <div
            class="relative"
            @pointerdown="onScrubAreaDown"
          >
            <EditorTimelineTrack
              label="Video"
              :clips="videoClips"
              :lane-width-px="laneWidthPx"
              :px-per-sec="zoom"
              :selected-clip-id="selectedClipId"
              :active-tool="activeTool"
              :dragging-clip-id="draggingClipId"
              @select-clip="onSelectClip"
              @remove-clip="onRemoveClip"
              @clip-drag-start="onClipDragStart"
              @clip-trim-start="onTrimStart"
            />
            <EditorTimelineTrack
              label="Audio"
              :clips="audioClips"
              :lane-width-px="laneWidthPx"
              :px-per-sec="zoom"
              :selected-clip-id="selectedClipId"
              :active-tool="activeTool"
              :dragging-clip-id="draggingClipId"
              @select-clip="onSelectClip"
              @remove-clip="onRemoveClip"
              @clip-drag-start="onClipDragStart"
              @clip-trim-start="onTrimStart"
            />

            <EditorTimelinePlayhead
              class="!left-0"
              :left-px="TRACK_LABEL_WIDTH + timeToPx(playhead, zoom)"
              :label="formatTimecode(playhead)"
              :scrubbing="isScrubbing"
              @scrub="onPlayheadScrub"
            />
          </div>
        </div>
      </div>
    </div>

    <p class="text-[11px] text-zinc-500">
      <span class="text-primary">⌘Z</span> undo ·
      <span class="text-primary">Delete</span> or
      <span class="text-primary">Remove clip</span> to take a clip off the timeline (files stay in Assets → Video) ·
      drag the teal playhead, ruler, or empty track to scrub ·
      Space to play/pause ·
      <span class="text-primary">Blend with next</span> for crossfade. Saved in this browser.
    </p>
  </div>
</template>

<script setup lang="ts">
import { appendPlaybackAccessToken } from '~/lib/project-asset-playback-url'
import { hasNextClipForBlend } from '~/lib/timeline-editor/blend'
import { useTimelineClipPushedState } from '~/lib/append-project-timeline-video'
import { formatTimecode, timeFromClientX, timeToPx, TRACK_LABEL_WIDTH } from '~/lib/timeline-editor/geometry'

const props = defineProps<{
  projectId: string
}>()

const toast = useToast()
const { getAuthToken } = useAuth()
const authTokenState = useState<string | null>('auth_token')

function resolveSrc (raw: string): string {
  void authTokenState.value
  const u = (raw || '').trim()
  if (!u) return ''
  return appendPlaybackAccessToken(u, getAuthToken())
}

const projectIdRef = computed(() => props.projectId)

const {
  clips,
  zoom,
  selectedClipId,
  selectedClip,
  activeTool,
  playhead,
  isPlaying,
  duration,
  videoClips,
  audioClips,
  canUndo,
  canRedo,
  setPlayhead,
  setZoom,
  selectClip,
  removeSelected,
  removeClipById,
  splitAtPlayhead,
  detachAudio,
  applyTransition,
  dragClipTo,
  trimLeft,
  trimRight,
  addAudioClip,
  blendWithNextClip,
  reloadFromStorage,
  undo,
  redo,
  beginGesture,
  commitGesture,
  cancelGesture
} = useTimelineEditorState(projectIdRef, resolveSrc)

const timelineClipPushed = useTimelineClipPushedState()

const setPlaying = (v: boolean) => {
  isPlaying.value = v
}

const playback = useTimelineEditorPlayback({
  clips: () => clips.value,
  playhead: () => playhead.value,
  isPlaying: () => isPlaying.value,
  duration: () => duration.value,
  setPlayhead,
  setPlaying,
  resolveSrc
})

const previewRef = ref<{
  videoRefA: HTMLVideoElement | null
  videoRefB: HTMLVideoElement | null
} | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const draggingClipId = ref<string | null>(null)

const laneWidthPx = computed(() => Math.max(640, duration.value * zoom.value + 80))
const isScrubbing = playback.isScrubbing
const activeVideoClip = computed(() => playback.activeVideoClip.value)

const blendPreviewLabel = computed(() => {
  const b = playback.blendPreview.value
  if (!b.outgoing || !b.incoming) return ''
  const pct = Math.round(b.mix * 100)
  return `Blend ${pct}% · ${b.outgoing.label} → ${b.incoming.label}`
})

const canBlend = computed(() => {
  const id = selectedClipId.value
  if (!id) return false
  const c = selectedClip.value
  return Boolean(c?.track === 'video' && hasNextClipForBlend(clips.value, id))
})

const canSplit = computed(() => {
  if (!selectedClip.value) return false
  const c = selectedClip.value
  if (c.linkedAudioId || c.linkedVideoId) return false
  const local = playhead.value - c.timelineStart
  return local > 0.25 && local < c.duration - 0.25
})

const canDetach = computed(() => {
  const c = selectedClip.value
  return Boolean(c?.type === 'video' && c.hasAudio && !c.linkedAudioId)
})

const rulerTicks = computed(() => {
  const step = duration.value > 60 ? 10 : duration.value > 30 ? 5 : 2
  const ticks: { t: number; label: string }[] = []
  for (let t = 0; t <= duration.value + 0.01; t += step) {
    ticks.push({ t, label: formatTimecode(t).slice(0, 5) })
  }
  return ticks
})

function onUndo () {
  if (undo()) {
    playback.seekPreviewToPlayhead(true)
    toast.showToast('Undone.', 'info')
  }
}

function onRedo () {
  if (redo()) {
    playback.seekPreviewToPlayhead(true)
    toast.showToast('Redone.', 'info')
  }
}

function onTogglePlay () {
  if (!videoClips.value.length) {
    toast.showToast('Add a video clip to the timeline first.', 'info')
    return
  }
  playback.togglePlay()
}

function onEditorKeydown (e: KeyboardEvent) {
  if (e.key === ' ' && !isTypingTarget(e.target)) {
    e.preventDefault()
    onTogglePlay()
    return
  }
  if (e.key === 'Escape' && (dragMode === 'move' || dragMode === 'trim-left' || dragMode === 'trim-right')) {
    cancelGesture()
    dragMode = null
    dragClipId = null
    draggingClipId.value = null
    playback.seekPreviewToPlayhead(true)
    return
  }
  if (
    (e.key === 'Delete' || e.key === 'Backspace') &&
    selectedClipId.value &&
    !isTypingTarget(e.target)
  ) {
    e.preventDefault()
    onRemoveSelected()
    return
  }
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return
  if (e.key === 'z' || e.key === 'Z') {
    e.preventDefault()
    if (e.shiftKey) onRedo()
    else onUndo()
  }
}

onMounted(() => {
  nextTick(bindPreviewVideo)
  if (import.meta.client) {
    window.addEventListener('keydown', onEditorKeydown)
  }
})

watch(previewRef, bindPreviewVideo)
watch(() => clips.value.length, () => {
  nextTick(bindPreviewVideo)
})

watch(
  timelineClipPushed,
  (ev) => {
    if (!ev || ev.projectId !== props.projectId) return
    reloadFromStorage()
    timelineClipPushed.value = null
  }
)

function unwrapVideoRef (r: unknown): HTMLVideoElement | null {
  if (!r) return null
  if (typeof r === 'object' && r !== null && 'value' in r) {
    return (r as Ref<HTMLVideoElement | null>).value
  }
  return r as HTMLVideoElement
}

function bindPreviewVideo () {
  const p = previewRef.value
  if (!p) return
  playback.bindVideo(unwrapVideoRef(p.videoRefA), unwrapVideoRef(p.videoRefB))
}

function timeAtPointer (ev: PointerEvent): number {
  const scroll = scrollRef.value
  if (!scroll) return playhead.value
  return timeFromClientX(ev.clientX, scroll, zoom.value, duration.value)
}

function applyPlayheadAtPointer (ev: PointerEvent) {
  setPlayhead(timeAtPointer(ev))
  playback.scheduleSeek()
}

function isTypingTarget (target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return Boolean(target.isContentEditable || target.closest('[contenteditable="true"]'))
}

function onRemoveSelected () {
  if (!selectedClipId.value) {
    toast.showToast('Select a clip on the timeline first.', 'info')
    return
  }
  const label = (selectedClip.value?.label || 'Clip').trim()
  if (removeSelected()) {
    playback.seekPreviewToPlayhead(true)
    toast.showToast(
      label
        ? `Removed “${label}” from timeline. Assets → Video is unchanged.`
        : 'Removed clip from timeline. Assets → Video is unchanged.',
      'success'
    )
  }
}

function onRemoveClip (clipId: string) {
  const clip = clips.value.find(c => c.id === clipId)
  const label = (clip?.label || 'Clip').trim()
  if (removeClipById(clipId)) {
    playback.seekPreviewToPlayhead(true)
    toast.showToast(
      label
        ? `Removed “${label}” from timeline. Assets → Video is unchanged.`
        : 'Removed clip from timeline. Assets → Video is unchanged.',
      'success'
    )
  }
}

function onBlend () {
  if (!selectedClipId.value) return
  if (blendWithNextClip(selectedClipId.value)) {
    toast.showToast('Crossfade applied — drag the timeline through the overlap to preview the blend.', 'success')
  } else {
    toast.showToast('Select a video clip with another clip after it.', 'info')
  }
}

function onSelectClip (id: string) {
  selectClip(id)
  if (activeTool.value === 'split') {
    onSplit()
  }
}

function onSplit () {
  if (!canSplit.value) {
    const c = selectedClip.value
    if (c?.linkedAudioId || c?.linkedVideoId) {
      toast.showToast('Split is disabled for linked video/audio pairs right now.', 'info')
    } else {
      toast.showToast('Move playhead inside the selected clip to split.', 'info')
    }
    return
  }
  splitAtPlayhead()
  toast.showToast('Clip split.', 'success')
}

function onStop () {
  playback.stop()
  setPlayhead(0)
  playback.seekPreviewToPlayhead()
}

function onAudioFile (ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  ;(ev.target as HTMLInputElement).value = ''
  if (!file) return
  addAudioClip({ label: file.name, url: URL.createObjectURL(file) })
  toast.showToast('Audio added to timeline.', 'success')
}

let dragMode: 'move' | 'trim-left' | 'trim-right' | 'scrub' | null = null
let dragClipId: string | null = null
let scrubPointerId: number | null = null
let dragStartX = 0
let dragStartTimeline = 0
let dragStartDuration = 0

function onClipDragStart (clipId: string, ev: PointerEvent) {
  if (activeTool.value !== 'select') return
  const clip = clips.value.find(c => c.id === clipId)
  if (!clip) return
  beginGesture()
  dragMode = 'move'
  dragClipId = clipId
  draggingClipId.value = clipId
  dragStartX = ev.clientX
  dragStartTimeline = clip.timelineStart
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
  window.addEventListener('pointercancel', onPointerUp, { once: true })
}

function onTrimStart (clipId: string, side: 'left' | 'right', ev: PointerEvent) {
  const clip = clips.value.find(c => c.id === clipId)
  if (!clip) return
  beginGesture()
  dragMode = side === 'left' ? 'trim-left' : 'trim-right'
  dragClipId = clipId
  dragStartX = ev.clientX
  dragStartTimeline = clip.timelineStart
  dragStartDuration = clip.duration
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
  window.addEventListener('pointercancel', onPointerUp, { once: true })
}

function onScrubAreaDown (ev: PointerEvent) {
  if (ev.button !== 0) return
  if ((ev.target as HTMLElement).closest('[data-clip-block]')) return
  if ((ev.target as HTMLElement).closest('[data-playhead]')) return
  startScrub(ev)
}

function onPlayheadScrub (ev: PointerEvent) {
  if (ev.button !== 0) return
  startScrub(ev)
}

function startScrub (ev: PointerEvent) {
  ev.preventDefault()
  dragMode = 'scrub'
  scrubPointerId = ev.pointerId
  playback.beginScrub()
  const scroll = scrollRef.value
  scroll?.setPointerCapture(ev.pointerId)
  document.body.style.cursor = 'grabbing'
  document.body.style.userSelect = 'none'
  applyPlayheadAtPointer(ev)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function endScrubDrag (ev: PointerEvent) {
  if (dragMode !== 'scrub') return
  const scroll = scrollRef.value
  if (scrubPointerId != null && scroll?.hasPointerCapture(scrubPointerId)) {
    scroll.releasePointerCapture(scrubPointerId)
  }
  scrubPointerId = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  applyPlayheadAtPointer(ev)
  playback.endScrub()
  playback.seekPreviewToPlayhead(true)
  dragMode = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

function onPointerMove (ev: PointerEvent) {
  if (dragMode === 'scrub') {
    if (scrubPointerId != null && ev.pointerId !== scrubPointerId) return
    applyPlayheadAtPointer(ev)
    return
  }

  if (!dragClipId) return
  const dx = ev.clientX - dragStartX
  const dt = dx / zoom.value

  if (dragMode === 'move') {
    dragClipTo(dragClipId, dragStartTimeline + dt)
  } else if (dragMode === 'trim-left') {
    trimLeft(dragClipId, dt)
  } else if (dragMode === 'trim-right') {
    trimRight(dragClipId, dt)
  }
}

function onPointerUp (ev: PointerEvent) {
  if (dragMode === 'scrub') {
    endScrubDrag(ev)
    return
  }
  if (dragMode === 'move' || dragMode === 'trim-left' || dragMode === 'trim-right') {
    commitGesture()
    playback.seekPreviewToPlayhead(true)
  }
  dragMode = null
  dragClipId = null
  draggingClipId.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onEditorKeydown)
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  playback.stop()
})

</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}
</style>
