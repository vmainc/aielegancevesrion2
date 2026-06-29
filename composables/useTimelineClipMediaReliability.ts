import { pocketBaseBearerHeaders } from '~/lib/pocketbase-auth-headers'
import {
  buildRepairedClipSrc,
  classifyTimelineClipMedia,
  clipEffectiveAssetId,
  resolveTimelineClipPlaybackSrc,
  timelineMediaReliabilitySummary,
  type TimelineClipMediaReliability
} from '~/lib/timeline-clip-media-reliability'
import type { ProjectAsset } from '~/types/project-asset'
import type { TimelineEditorClip } from '~/types/timeline-editor'

export function useTimelineClipMediaReliability (
  projectId: Ref<string>,
  clips: Ref<TimelineEditorClip[]>
) {
  const { getAuthToken } = useAuth()

  const assetsById = ref(new Map<string, ProjectAsset>())
  const assetsLoading = ref(false)
  const assetsError = ref<string | null>(null)

  async function loadProjectAssets () {
    const pid = projectId.value.trim()
    if (!import.meta.client || !pid) return
    assetsLoading.value = true
    assetsError.value = null
    try {
      const token = getAuthToken()
      if (!token) return
      const res = await $fetch<{ items: ProjectAsset[] }>(`/api/projects/${pid}/assets`, {
        headers: pocketBaseBearerHeaders(token)
      })
      const map = new Map<string, ProjectAsset>()
      for (const item of res.items || []) {
        if (item?.id) map.set(item.id, item)
      }
      assetsById.value = map
    } catch (e: unknown) {
      assetsError.value = e instanceof Error ? e.message : 'Could not load project assets'
    } finally {
      assetsLoading.value = false
    }
  }

  watch(projectId, () => {
    void loadProjectAssets()
  }, { immediate: true })

  function mediaReliabilityForClip (clip: TimelineEditorClip): TimelineClipMediaReliability {
    return classifyTimelineClipMedia(clip, {
      projectId: projectId.value,
      assetsById: assetsById.value
    })
  }

  const reliabilityByClipId = computed(() => {
    const map = new Map<string, TimelineClipMediaReliability>()
    for (const clip of clips.value) {
      map.set(clip.id, mediaReliabilityForClip(clip))
    }
    return map
  })

  const summary = computed(() =>
    timelineMediaReliabilitySummary(clips.value, {
      projectId: projectId.value,
      assetsById: assetsById.value
    })
  )

  const issueClipCount = computed(() => {
    const s = summary.value
    return s.local_blob + s.missing + s.recoverable + s.url_only
  })

  function resolveClipPlayback (clip: TimelineEditorClip): string {
    return resolveTimelineClipPlaybackSrc(clip, projectId.value, getAuthToken(), {
      assetsById: assetsById.value,
      preferRuntimeRepair: true
    })
  }

  /** Resolve playback from stored src string (matches clip by src or id). */
  function resolveSrcForPlayback (raw: string): string {
    const trimmed = (raw || '').trim()
    const bySrc = clips.value.find((c) => c.src === trimmed)
    if (bySrc) return resolveClipPlayback(bySrc)
    const byId = clips.value.find((c) => c.id === trimmed)
    if (byId) return resolveClipPlayback(byId)
    return resolveTimelineClipPlaybackSrc(
      { id: '', type: 'video', track: 'video', src: trimmed, label: '', sourceStart: 0, sourceEnd: 0, timelineStart: 0, duration: 0, transitionIn: null, transitionOut: null },
      projectId.value,
      getAuthToken()
    )
  }

  function canRepairClip (clip: TimelineEditorClip): boolean {
    const reliability = mediaReliabilityForClip(clip)
    if (reliability !== 'recoverable' && reliability !== 'missing') return false
    return Boolean(buildRepairedClipSrc(clip, projectId.value, assetsById.value))
  }

  function repairedSrcForClip (clip: TimelineEditorClip): string | null {
    return buildRepairedClipSrc(clip, projectId.value, assetsById.value)
  }

  function linkedClipIds (clipId: string): string[] {
    const clip = clips.value.find((c) => c.id === clipId)
    if (!clip) return [clipId]
    const ids = [clipId]
    if (clip.linkedAudioId) ids.push(clip.linkedAudioId)
    if (clip.linkedVideoId) ids.push(clip.linkedVideoId)
    const assetId = clipEffectiveAssetId(clip)
    if (assetId) {
      for (const c of clips.value) {
        if (clipEffectiveAssetId(c) === assetId && !ids.includes(c.id)) ids.push(c.id)
      }
    }
    return ids
  }

  return {
    assetsById,
    assetsLoading,
    assetsError,
    loadProjectAssets,
    mediaReliabilityForClip,
    reliabilityByClipId,
    summary,
    issueClipCount,
    resolveClipPlayback,
    resolveSrcForPlayback,
    canRepairClip,
    repairedSrcForClip,
    linkedClipIds
  }
}
