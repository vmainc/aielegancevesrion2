import { computed, ref, unref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

export type TimelineClipKind = 'video' | 'audio'

export interface TimelineClip {
  id: string
  kind: TimelineClipKind
  label: string
  url: string
  sceneId?: string
  shotId?: string
}

export interface TimelineState {
  video: TimelineClip[]
  audio: TimelineClip[]
}

function newClipId (): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function emptyState (): TimelineState {
  return { video: [], audio: [] }
}

function parseState (raw: string | null): TimelineState {
  if (!raw) return emptyState()
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object') return emptyState()
    const o = j as Record<string, unknown>
    const video = Array.isArray(o.video) ? o.video : []
    const audio = Array.isArray(o.audio) ? o.audio : []
    const norm = (rows: unknown[], kind: TimelineClipKind): TimelineClip[] => {
      const out: TimelineClip[] = []
      for (const r of rows) {
        if (!r || typeof r !== 'object') continue
        const row = r as Record<string, unknown>
        const id = typeof row.id === 'string' ? row.id : ''
        const label = typeof row.label === 'string' ? row.label : 'Clip'
        const url = typeof row.url === 'string' ? row.url : ''
        if (!id || !url.trim()) continue
        const sceneId =
          typeof row.scene_id === 'string'
            ? row.scene_id
            : typeof row.sceneId === 'string'
              ? row.sceneId
              : undefined
        const shotId =
          typeof row.shot_id === 'string'
            ? row.shot_id
            : typeof row.shotId === 'string'
              ? row.shotId
              : undefined
        out.push({
          id,
          kind,
          label: label.slice(0, 500),
          url: url.trim(),
          sceneId,
          shotId
        })
      }
      return out
    }
    return {
      video: norm(video, 'video'),
      audio: norm(audio, 'audio')
    }
  } catch {
    return emptyState()
  }
}

/** Per-project timeline (browser localStorage). Video URLs from generation persist; uploaded audio uses blob URLs for the session only. */
export function useProjectTimeline (projectId: Ref<string> | ComputedRef<string>) {
  const pid = computed(() => {
    const v = unref(projectId)
    return typeof v === 'string' ? v : ''
  })

  const storageKey = computed(() => (pid.value ? `aie_timeline_v1_${pid.value}` : ''))

  const state = ref<TimelineState>(emptyState())

  function load () {
    if (!import.meta.client || !storageKey.value) {
      state.value = emptyState()
      return
    }
    state.value = parseState(localStorage.getItem(storageKey.value))
  }

  function persist () {
    if (!import.meta.client || !storageKey.value) return
    const payload = {
      video: state.value.video.map(c => ({
        id: c.id,
        label: c.label,
        url: c.url,
        scene_id: c.sceneId,
        shot_id: c.shotId
      })),
      audio: state.value.audio.map(c => ({
        id: c.id,
        label: c.label,
        url: c.url
      }))
    }
    localStorage.setItem(storageKey.value, JSON.stringify(payload))
  }

  watch(
    () => pid.value,
    () => load(),
    { immediate: true }
  )

  function addVideoClip (clip: Omit<TimelineClip, 'id' | 'kind'> & { id?: string }) {
    const id = clip.id?.trim() || newClipId()
    state.value.video.push({
      id,
      kind: 'video',
      label: clip.label.slice(0, 500),
      url: clip.url.trim(),
      sceneId: clip.sceneId,
      shotId: clip.shotId
    })
    persist()
  }

  function addAudioClip (clip: { label: string; url: string; id?: string }) {
    const id = clip.id?.trim() || newClipId()
    state.value.audio.push({
      id,
      kind: 'audio',
      label: clip.label.slice(0, 500),
      url: clip.url.trim()
    })
    persist()
  }

  function removeVideoClip (id: string) {
    state.value.video = state.value.video.filter(c => c.id !== id)
    persist()
  }

  function removeAudioClip (id: string) {
    state.value.audio = state.value.audio.filter(c => c.id !== id)
    persist()
  }

  function reorderVideo (from: number, to: number) {
    const arr = [...state.value.video]
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return
    const [item] = arr.splice(from, 1)
    if (!item) return
    arr.splice(to, 0, item)
    state.value.video = arr
    persist()
  }

  function reorderAudio (from: number, to: number) {
    const arr = [...state.value.audio]
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return
    const [item] = arr.splice(from, 1)
    if (!item) return
    arr.splice(to, 0, item)
    state.value.audio = arr
    persist()
  }

  return {
    state,
    load,
    addVideoClip,
    addAudioClip,
    removeVideoClip,
    removeAudioClip,
    reorderVideo,
    reorderAudio
  }
}
