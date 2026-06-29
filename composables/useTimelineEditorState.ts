import { computed, ref, unref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import {
  createLinkedVideoAudioClipsFromUrl,
  deleteClip,
  detachAudioFromVideo,
  moveClipOnTrack,
  newTimelineClipId,
  normalizeTrackLayout,
  setClipTransition,
  clipIdsToCutAtTime,
  splitClipAtPlayhead,
  splitResultChanged,
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
import { cloneTimelineClips } from '~/lib/timeline-editor/clone'
import { useTimelineEditorHistory } from '~/composables/useTimelineEditorHistory'
import type { TimelineHistorySnapshot } from '~/lib/timeline-editor/history'
import {
  DEFAULT_ZOOM_PX_PER_SEC,
  type TimelineEditorClip,
  type TimelineEditorDocument,
  type TimelineEditorTool,
  type TimelineTransitionType
} from '~/types/timeline-editor'

export type TimelineEditorPersistenceOptions = {
  /** When true, parent must call `loadFromDocument` after cloud/local resolution. */
  deferInitialLoad?: boolean
  onAfterPersist?: (doc: TimelineEditorDocument) => void
}

export function useTimelineEditorState (
  projectId: Ref<string> | ComputedRef<string>,
  resolvePlaybackSrc: (raw: string) => string,
  persistence?: TimelineEditorPersistenceOptions
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
      clips: cloneTimelineClips(clips.value),
      zoom: zoom.value,
      selectedClipId: selectedClipId.value
    }
  }

  function applySnapshot (s: TimelineHistorySnapshot) {
    clips.value = cloneTimelineClips(s.clips)
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
    persistence?.onAfterPersist?.({
      version: 2,
      clips: clips.value,
      zoom: zoom.value
    })
  }

  function loadFromDocument (doc: TimelineEditorDocument | null | undefined) {
    history.clearHistory()
    if (!doc?.clips.length) {
      clips.value = []
      zoom.value = DEFAULT_ZOOM_PX_PER_SEC
      return
    }
    clips.value = doc.clips
    zoom.value = doc.zoom
    void refreshDurations(false)
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

  watch(() => pid.value, () => {
    if (persistence?.deferInitialLoad) return
    load()
  }, { immediate: !persistence?.deferInitialLoad })

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
    const linked = createLinkedVideoAudioClipsFromUrl({
      src: clip.url,
      label: clip.label,
      timelineStart: end,
      sceneId: clip.sceneId,
      shotId: clip.shotId,
      videoId: clip.id
    })
    clips.value = normalizeTrackLayout(
      normalizeTrackLayout([...clips.value, linked.video, linked.audio], 'video'),
      'audio'
    )
    selectedClipId.value = linked.video.id
    persist()
    void probeVideoDuration(resolvePlaybackSrc(linked.video.src)).then((dur) => {
      clips.value = clips.value.map((c) => {
        if (c.id === linked.video.id || c.id === linked.audio.id) {
          return { ...c, sourceStart: 0, sourceEnd: dur, duration: dur }
        }
        return c
      })
      persist()
    })
  }

  function syncLinkedCompanion (next: TimelineEditorClip[], clipId: string): TimelineEditorClip[] {
    const clip = next.find(c => c.id === clipId)
    if (!clip) return next
    if (clip.linkedAudioId) {
      return next.map((c) =>
        c.id === clip.linkedAudioId
          ? {
              ...c,
              timelineStart: clip.timelineStart,
              sourceStart: clip.sourceStart,
              sourceEnd: clip.sourceEnd,
              duration: clip.duration
            }
          : c
      )
    }
    if (clip.linkedVideoId) {
      return next.map((c) =>
        c.id === clip.linkedVideoId
          ? {
              ...c,
              timelineStart: clip.timelineStart,
              sourceStart: clip.sourceStart,
              sourceEnd: clip.sourceEnd,
              duration: clip.duration
            }
          : c
      )
    }
    return next
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

  function splitClipAtTime (clipId: string, cutTimeSec: number): boolean {
    if (!clipId) return false
    const before = clips.value
    const next = splitClipAtPlayhead(before, clipId, cutTimeSec)
    if (!splitResultChanged(before, next)) return false
    history.recordHistory()
    clips.value = next
    persist()
    return true
  }

  function splitAtPlayhead (): boolean {
    if (!selectedClipId.value) return false
    return splitClipAtTime(selectedClipId.value, playhead.value)
  }

  /** Cut every clip (and linked pair) that spans `t`. Returns number of cuts made. */
  function razorCutAllAtTime (t: number): number {
    const ids = clipIdsToCutAtTime(clips.value, t)
    if (!ids.length) return 0
    history.recordHistory()
    let next = clips.value
    let cuts = 0
    for (const id of ids) {
      const before = next
      next = splitClipAtPlayhead(next, id, t)
      if (splitResultChanged(before, next)) cuts++
    }
    if (!cuts) return 0
    clips.value = next
    persist()
    return cuts
  }

  function detachAudio () {
    if (!selectedClipId.value) return
    const v = clips.value.find(c => c.id === selectedClipId.value && c.type === 'video')
    if (!v?.hasAudio) return
    history.recordHistory()
    clips.value = detachAudioFromVideo(clips.value, selectedClipId.value)
    persist()
  }

  function applyCrossfadePair (videoClipId: string): boolean {
    let next = applyCrossfadeWithNext(clips.value, videoClipId)
    if (next === clips.value) return false
    const video = next.find(c => c.id === videoClipId)
    if (video?.linkedAudioId) {
      const audioBlend = applyCrossfadeWithNext(next, video.linkedAudioId)
      if (audioBlend !== next) next = audioBlend
    }
    clips.value = next
    return true
  }

  function applyTransition (which: 'in' | 'out', t: TimelineTransitionType) {
    if (!selectedClipId.value) return
    history.recordHistory()
    if (t === 'crossfade' && which === 'out') {
      if (!applyCrossfadePair(selectedClipId.value)) {
        clips.value = setClipTransition(clips.value, selectedClipId.value, which, t)
      }
    } else {
      clips.value = setClipTransition(clips.value, selectedClipId.value, which, t)
    }
    persist()
  }

  function dragClipTo (clipId: string, timelineStart: number) {
    clips.value = syncLinkedCompanion(
      moveClipOnTrack(clips.value, clipId, timelineStart),
      clipId
    )
    persist()
  }

  function trimLeft (clipId: string, deltaSec: number) {
    clips.value = syncLinkedCompanion(trimClipLeft(clips.value, clipId, deltaSec), clipId)
    persist()
  }

  function trimRight (clipId: string, deltaSec: number) {
    clips.value = syncLinkedCompanion(trimClipRight(clips.value, clipId, deltaSec), clipId)
    persist()
  }

  function blendWithNextClip (clipId?: string) {
    const id = clipId ?? selectedClipId.value
    if (!id) return false
    const clip = clips.value.find(c => c.id === id)
    if (!clip || clip.track !== 'video') return false
    history.recordHistory()
    if (!applyCrossfadePair(id)) return false
    persist()
    return true
  }

  function repairClipMedia (clipId: string, newSrc: string) {
    const bare = newSrc.trim()
    if (!clipId || !bare) return false
    const target = clips.value.find((c) => c.id === clipId)
    if (!target) return false
    history.recordHistory()
    const linked = new Set<string>([clipId])
    if (target.linkedAudioId) linked.add(target.linkedAudioId)
    if (target.linkedVideoId) linked.add(target.linkedVideoId)
    clips.value = clips.value.map((c) => {
      if (linked.has(c.id)) {
        return { ...c, src: bare }
      }
      return c
    })
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
    loadFromDocument,
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
    splitClipAtTime,
    razorCutAllAtTime,
    detachAudio,
    applyTransition,
    dragClipTo,
    trimLeft,
    trimRight,
    blendWithNextClip,
    reloadFromStorage,
    repairClipMedia,
    refreshDurations,
    undo: history.undo,
    redo: history.redo,
    beginGesture: history.beginGesture,
    commitGesture: history.commitGesture,
    cancelGesture: history.cancelGesture
  }
}
