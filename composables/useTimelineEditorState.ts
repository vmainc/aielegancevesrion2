import { computed, ref, unref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import {
  createVideoClipFromUrl,
  deleteClip,
  detachAudioFromVideo,
  moveClipOnTrack,
  newTimelineClipId,
  normalizeTrackLayout,
  setClipTransition,
  splitClipAtPlayhead,
  trimClipLeft,
  trimClipRight
} from '~/lib/timeline-editor/clip-ops'
import { applyCrossfadeWithNext } from '~/lib/timeline-editor/blend'
import { totalTimelineDuration } from '~/lib/timeline-editor/geometry'
import { applyProbedDurations, probeVideoDuration } from '~/lib/timeline-editor/media-probe'
import {
  loadTimelineFromStorage,
  saveTimelineToStorage
} from '~/lib/timeline-editor/storage'
import { useTimelineEditorHistory } from '~/composables/useTimelineEditorHistory'
import type { TimelineHistorySnapshot } from '~/lib/timeline-editor/history'
import {
  DEFAULT_ZOOM_PX_PER_SEC,
  type TimelineEditorClip,
  type TimelineEditorTool,
  type TimelineTransitionType
} from '~/types/timeline-editor'

export function useTimelineEditorState (
  projectId: Ref<string> | ComputedRef<string>,
  resolvePlaybackSrc: (raw: string) => string
) {
  const pid = computed(() => {
    const v = unref(projectId)
    return typeof v === 'string' ? v : ''
  })

  const clips = ref<TimelineEditorClip[]>([])
  const zoom = ref(DEFAULT_ZOOM_PX_PER_SEC)
  const selectedClipId = ref<string | null>(null)
  const activeTool = ref<TimelineEditorTool>('select')
  const playhead = ref(0)
  const isPlaying = ref(false)

  const selectedClip = computed(() => clips.value.find(c => c.id === selectedClipId.value) ?? null)
  const duration = computed(() => totalTimelineDuration(clips.value))
  const videoClips = computed(() => clips.value.filter(c => c.track === 'video').sort((a, b) => a.timelineStart - b.timelineStart))
  const audioClips = computed(() => clips.value.filter(c => c.track === 'audio').sort((a, b) => a.timelineStart - b.timelineStart))

  function getSnapshot (): TimelineHistorySnapshot {
    return {
      clips: structuredClone(clips.value),
      zoom: zoom.value,
      selectedClipId: selectedClipId.value
    }
  }

  function applySnapshot (s: TimelineHistorySnapshot) {
    clips.value = structuredClone(s.clips)
    zoom.value = s.zoom
    selectedClipId.value = s.selectedClipId
    const max = totalTimelineDuration(clips.value)
    if (playhead.value > max) playhead.value = max
    persist()
  }

  const history = useTimelineEditorHistory(getSnapshot, applySnapshot)

  function persist () {
    if (!pid.value) return
    saveTimelineToStorage(pid.value, clips.value, zoom.value)
  }

  function applyLoadedDocument () {
    const doc = loadTimelineFromStorage(pid.value)
    if (doc?.clips.length) {
      clips.value = doc.clips
      zoom.value = doc.zoom
      void refreshDurations(false)
      return
    }
    clips.value = []
    zoom.value = DEFAULT_ZOOM_PX_PER_SEC
  }

  /** Re-read v2 document from localStorage (keeps undo stack). */
  function reloadFromStorage () {
    if (!import.meta.client || !pid.value) return
    const doc = loadTimelineFromStorage(pid.value)
    if (!doc?.clips.length) return
    clips.value = doc.clips
    zoom.value = doc.zoom
    const max = totalTimelineDuration(clips.value)
    if (playhead.value > max) playhead.value = max
    void refreshDurations(false)
  }

  function load () {
    history.clearHistory()
    if (!import.meta.client || !pid.value) {
      clips.value = []
      return
    }
    applyLoadedDocument()
  }

  async function refreshDurations (recordHistory = false) {
    if (recordHistory) history.recordHistory()
    clips.value = await applyProbedDurations(clips.value, resolvePlaybackSrc)
    persist()
  }

  watch(() => pid.value, load, { immediate: true })

  function setClips (next: TimelineEditorClip[], recordHistory = true) {
    if (recordHistory) history.recordHistory()
    clips.value = next
    persist()
  }

  function selectClip (id: string | null) {
    selectedClipId.value = id
  }

  function setPlayhead (t: number) {
    playhead.value = Math.max(0, Math.min(t, duration.value))
  }

  function setZoom (px: number) {
    zoom.value = Math.max(16, Math.min(120, px))
    persist()
  }

  function addVideoFromLibrary (clip: {
    url: string
    label: string
    sceneId?: string
    shotId?: string
    id?: string
  }) {
    history.recordHistory()
    const trackClips = clips.value.filter(c => c.track === 'video')
    const end = trackClips.reduce((m, c) => Math.max(m, c.timelineStart + c.duration), 0)
    const created = createVideoClipFromUrl({
      src: clip.url,
      label: clip.label,
      timelineStart: end,
      sceneId: clip.sceneId,
      shotId: clip.shotId,
      id: clip.id
    })
    clips.value = normalizeTrackLayout([...clips.value, created], 'video')
    selectedClipId.value = created.id
    persist()
    void probeVideoDuration(resolvePlaybackSrc(created.src)).then((dur) => {
      clips.value = clips.value.map(c =>
        c.id === created.id ? { ...c, sourceStart: 0, sourceEnd: dur, duration: dur } : c
      )
      persist()
    })
  }

  function addAudioClip (opts: { url: string; label: string }) {
    history.recordHistory()
    const end = audioClips.value.reduce((m, c) => Math.max(m, c.timelineStart + c.duration), 0)
    const created: TimelineEditorClip = {
      id: newTimelineClipId(),
      type: 'audio',
      track: 'audio',
      src: opts.url,
      label: opts.label,
      sourceStart: 0,
      sourceEnd: 5,
      timelineStart: end,
      duration: 5,
      transitionIn: null,
      transitionOut: null
    }
    clips.value = normalizeTrackLayout([...clips.value, created], 'audio')
    persist()
  }

  function removeClipById (clipId: string) {
    if (!clipId || !clips.value.some(c => c.id === clipId)) return false
    history.recordHistory()
    clips.value = deleteClip(clips.value, clipId)
    if (selectedClipId.value === clipId) selectedClipId.value = null
    persist()
    return true
  }

  function removeSelected () {
    if (!selectedClipId.value) return false
    return removeClipById(selectedClipId.value)
  }

  function splitAtPlayhead () {
    if (!selectedClipId.value) return
    history.recordHistory()
    clips.value = splitClipAtPlayhead(clips.value, selectedClipId.value, playhead.value)
    persist()
  }

  function detachAudio () {
    if (!selectedClipId.value) return
    const v = clips.value.find(c => c.id === selectedClipId.value && c.type === 'video')
    if (!v?.hasAudio) return
    history.recordHistory()
    clips.value = detachAudioFromVideo(clips.value, selectedClipId.value)
    persist()
  }

  function applyTransition (which: 'in' | 'out', t: TimelineTransitionType) {
    if (!selectedClipId.value) return
    history.recordHistory()
    clips.value = setClipTransition(clips.value, selectedClipId.value, which, t)
    persist()
  }

  function dragClipTo (clipId: string, timelineStart: number) {
    clips.value = moveClipOnTrack(clips.value, clipId, timelineStart)
    persist()
  }

  function trimLeft (clipId: string, deltaSec: number) {
    clips.value = trimClipLeft(clips.value, clipId, deltaSec)
    persist()
  }

  function trimRight (clipId: string, deltaSec: number) {
    clips.value = trimClipRight(clips.value, clipId, deltaSec)
    persist()
  }

  function blendWithNextClip (clipId?: string) {
    const id = clipId ?? selectedClipId.value
    if (!id) return false
    const next = applyCrossfadeWithNext(clips.value, id)
    if (next === clips.value) return false
    history.recordHistory()
    clips.value = next
    persist()
    return true
  }

  return {
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
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    load,
    persist,
    setClips,
    selectClip,
    setPlayhead,
    setZoom,
    addVideoFromLibrary,
    addAudioClip,
    removeSelected,
    removeClipById,
    splitAtPlayhead,
    detachAudio,
    applyTransition,
    dragClipTo,
    trimLeft,
    trimRight,
    blendWithNextClip,
    reloadFromStorage,
    refreshDurations,
    undo: history.undo,
    redo: history.redo,
    beginGesture: history.beginGesture,
    commitGesture: history.commitGesture,
    cancelGesture: history.cancelGesture
  }
}
