import { computed, ref } from 'vue'
import {
  cloneTimelineSnapshot,
  MAX_TIMELINE_HISTORY,
  timelineSnapshotsEqual,
  type TimelineHistorySnapshot
} from '~/lib/timeline-editor/history'
import type { TimelineEditorClip } from '~/types/timeline-editor'

/**
 * Undo/redo stack for timeline editor clips + zoom.
 * Use beginGesture/commitGesture to group drag/trim into one undo step.
 */
export function useTimelineEditorHistory (getState: () => TimelineHistorySnapshot, applyState: (s: TimelineHistorySnapshot) => void) {
  const past = ref<TimelineHistorySnapshot[]>([])
  const future = ref<TimelineHistorySnapshot[]>([])
  let gestureActive = false
  let gestureBaseline: TimelineHistorySnapshot | null = null

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function clearHistory () {
    past.value = []
    future.value = []
    gestureActive = false
    gestureBaseline = null
  }

  function recordHistory () {
    if (gestureActive) return
    const snap = cloneTimelineSnapshot(getState())
    const last = past.value[past.value.length - 1]
    if (last && timelineSnapshotsEqual(last, snap)) return
    past.value.push(snap)
    if (past.value.length > MAX_TIMELINE_HISTORY) {
      past.value.shift()
    }
    future.value = []
  }

  function beginGesture () {
    if (gestureActive) return
    gestureActive = true
    gestureBaseline = cloneTimelineSnapshot(getState())
  }

  function commitGesture () {
    if (!gestureActive || !gestureBaseline) {
      gestureActive = false
      gestureBaseline = null
      return
    }
    const baseline = gestureBaseline
    gestureActive = false
    gestureBaseline = null
    const after = getState()
    if (timelineSnapshotsEqual(baseline, after)) return
    past.value.push(baseline)
    if (past.value.length > MAX_TIMELINE_HISTORY) past.value.shift()
    future.value = []
  }

  function cancelGesture () {
    if (!gestureActive || !gestureBaseline) return
    applyState(cloneTimelineSnapshot(gestureBaseline))
    gestureActive = false
    gestureBaseline = null
  }

  function undo () {
    if (!past.value.length) return false
    const current = cloneTimelineSnapshot(getState())
    const prev = past.value.pop()!
    future.value.push(current)
    applyState(cloneTimelineSnapshot(prev))
    return true
  }

  function redo () {
    if (!future.value.length) return false
    const current = cloneTimelineSnapshot(getState())
    const next = future.value.pop()!
    past.value.push(current)
    applyState(cloneTimelineSnapshot(next))
    return true
  }

  /** Apply a mutation and optionally record undo point (default true). */
  function mutate (fn: (clips: TimelineEditorClip[]) => TimelineEditorClip[], opts?: { record?: boolean }) {
    if (opts?.record !== false) recordHistory()
    const state = getState()
    const nextClips = fn(structuredClone(state.clips))
    applyState({ ...state, clips: nextClips })
  }

  return {
    canUndo,
    canRedo,
    clearHistory,
    recordHistory,
    beginGesture,
    commitGesture,
    cancelGesture,
    undo,
    redo,
    mutate
  }
}
