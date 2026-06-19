import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { clipTimelineEnd } from '~/lib/timeline-editor/geometry'
import { clipsOnTrack, findClipAtTime } from '~/lib/timeline-editor/clip-ops'
import { getBlendAtTime, type TimelineBlendFrame } from '~/lib/timeline-editor/blend'
import { applyCrossOriginForMediaSrc } from '~/lib/timeline-editor/media-cross-origin'
import type { TimelineEditorClip } from '~/types/timeline-editor'

export interface PreviewBlendState {
  outgoing: TimelineEditorClip | null
  incoming: TimelineEditorClip | null
  mix: number
}

/**
 * Syncs HTML5 preview with timeline playhead — frame seeks while scrubbing, crossfade blend in overlap zones.
 */
export function useTimelineEditorPlayback (opts: {
  clips: () => TimelineEditorClip[]
  playhead: () => number
  isPlaying: () => boolean
  duration: () => number
  setPlayhead: (t: number) => void
  setPlaying: (v: boolean) => void
  resolveSrc: (raw: string) => string
}) {
  const videoEl = ref<HTMLVideoElement | null>(null)
  const videoElB = ref<HTMLVideoElement | null>(null)
  const audioEl = ref<HTMLAudioElement | null>(null)
  const isScrubbing = ref(false)
  const activeClipId = ref<string | null>(null)
  const activeAudioClipId = ref<string | null>(null)
  const blendPreview = shallowRef<PreviewBlendState>({
    outgoing: null,
    incoming: null,
    mix: 0
  })
  const rafId = ref<number | null>(null)
  const lastTick = ref(0)
  let pendingSeekRaf: number | null = null

  const activeVideoClip = computed(() => {
    const t = opts.playhead()
    const blend = getBlendAtTime(opts.clips(), 'video', t)
    if (blend) return blend.mix < 0.5 ? blend.outgoing : blend.incoming
    return findClipAtTime(opts.clips(), 'video', t)
  })

  function bindVideo (primary: HTMLVideoElement | null, secondary?: HTMLVideoElement | null) {
    videoEl.value = primary
    videoElB.value = secondary ?? null
  }

  function bindAudio (el: HTMLAudioElement | null) {
    audioEl.value = el
  }

  /** Audio track clip at playhead, or linked audio for the active video clip. */
  function resolveAudioClipAtTime (t: number): TimelineEditorClip | null {
    const onTrack = findClipAtTime(opts.clips(), 'audio', t)
    if (onTrack) return onTrack
    const video = findClipAtTime(opts.clips(), 'video', t)
    if (video?.linkedAudioId) {
      return opts.clips().find(c => c.id === video.linkedAudioId) ?? null
    }
    return null
  }

  function syncVideoMuteForPlayhead () {
    const t = opts.playhead()
    const video = findClipAtTime(opts.clips(), 'video', t)
    const useEmbeddedVideoAudio = Boolean(
      video?.hasAudio && !video.linkedAudioId && !resolveAudioClipAtTime(t)
    )
    const unmute = opts.isPlaying() && !isScrubbing.value && useEmbeddedVideoAudio
    if (videoEl.value) videoEl.value.muted = !unmute
    if (videoElB.value) videoElB.value.muted = true
  }

  function localSourceTime (clip: TimelineEditorClip, timelineT: number): number {
    const local = timelineT - clip.timelineStart
    return clip.sourceStart + Math.max(0, Math.min(local, clip.duration - 0.001))
  }

  function ensureClipOnElement (el: HTMLVideoElement, clip: TimelineEditorClip, clipKey: string) {
    const src = opts.resolveSrc(clip.src)
    if (el.dataset.clipId !== clipKey || el.src !== src) {
      el.dataset.clipId = clipKey
      applyCrossOriginForMediaSrc(el, src)
      el.src = src
      el.load()
    }
  }

  function seekMediaElement (
    el: HTMLVideoElement | HTMLAudioElement,
    seconds: number,
    force: boolean
  ) {
    const threshold = isScrubbing.value || force ? 0.03 : 0.08
    if (!force && Math.abs(el.currentTime - seconds) < threshold) return
    try {
      if (typeof el.fastSeek === 'function' && isScrubbing.value) {
        el.fastSeek(seconds)
      } else {
        el.currentTime = seconds
      }
    } catch {
      /* ignore seek race */
    }
  }

  function seekElement (el: HTMLVideoElement, seconds: number, force: boolean) {
    seekMediaElement(el, seconds, force)
  }

  function ensureClipOnAudioElement (el: HTMLAudioElement, clip: TimelineEditorClip) {
    const src = opts.resolveSrc(clip.src)
    if (el.dataset.clipId !== clip.id || el.src !== src) {
      el.dataset.clipId = clip.id
      applyCrossOriginForMediaSrc(el, src)
      el.src = src
      el.load()
    }
  }

  function seekAudioToPlayhead (force = false) {
    const t = opts.playhead()
    const clip = resolveAudioClipAtTime(t)
    const el = audioEl.value

    if (!clip || !el) {
      activeAudioClipId.value = null
      el?.pause()
      syncVideoMuteForPlayhead()
      return
    }

    const target = localSourceTime(clip, t)
    if (activeAudioClipId.value !== clip.id) {
      activeAudioClipId.value = clip.id
      ensureClipOnAudioElement(el, clip)
    }

    if (isScrubbing.value) {
      el.pause()
    }

    seekMediaElement(el, target, force || isScrubbing.value)
    syncVideoMuteForPlayhead()

    if (opts.isPlaying() && !isScrubbing.value) {
      el.play().catch(() => {})
    }
  }

  function applyBlendToPreview (blend: TimelineBlendFrame | null) {
    const elA = videoEl.value
    const elB = videoElB.value
    const t = opts.playhead()

    if (!blend || !elA || !elB) {
      blendPreview.value = { outgoing: null, incoming: null, mix: 0 }
      if (elB) {
        elB.style.opacity = '0'
        elB.pause()
      }
      return
    }

    blendPreview.value = {
      outgoing: blend.outgoing,
      incoming: blend.incoming,
      mix: blend.mix
    }

    ensureClipOnElement(elA, blend.outgoing, blend.outgoing.id)
    ensureClipOnElement(elB, blend.incoming, blend.incoming.id)

    const tOut = localSourceTime(blend.outgoing, t)
    const tIn = localSourceTime(blend.incoming, t)
    seekElement(elA, tOut, true)
    seekElement(elB, tIn, true)

    elA.style.opacity = String(1 - blend.mix)
    elB.style.opacity = String(blend.mix)
    elA.style.zIndex = blend.mix < 0.5 ? '2' : '1'
    elB.style.zIndex = blend.mix >= 0.5 ? '2' : '1'

    if (opts.isPlaying()) {
      elA.play().catch(() => {})
      elB.play().catch(() => {})
    } else {
      elA.pause()
      elB.pause()
    }
  }

  function sortedVideoClips () {
    return clipsOnTrack(opts.clips(), 'video')
  }

  function resumePreviewPlayback () {
    if (!opts.isPlaying() || isScrubbing.value) return
    syncVideoMuteForPlayhead()
    videoEl.value?.play().catch(() => {})
    videoElB.value?.play().catch(() => {})
    seekAudioToPlayhead(false)
  }

  function sortedAudioClips () {
    return clipsOnTrack(opts.clips(), 'audio')
  }

  /** While playing, skip empty timeline gaps instead of stopping. */
  function snapPlayheadOverGaps (t: number): number {
    if (
      findClipAtTime(opts.clips(), 'video', t) ||
      findClipAtTime(opts.clips(), 'audio', t) ||
      getBlendAtTime(opts.clips(), 'video', t)
    ) {
      return t
    }
    const upcomingStarts = [
      sortedVideoClips().find(c => c.timelineStart > t + 0.0005)?.timelineStart,
      sortedAudioClips().find(c => c.timelineStart > t + 0.0005)?.timelineStart
    ].filter((n): n is number => n != null)
    if (upcomingStarts.length) return Math.min(...upcomingStarts)
    const lastVideo = sortedVideoClips().at(-1)
    const lastAudio = sortedAudioClips().at(-1)
    const lastEnd = Math.max(
      lastVideo ? clipTimelineEnd(lastVideo) : 0,
      lastAudio ? clipTimelineEnd(lastAudio) : 0
    )
    if (lastEnd > 0) return Math.min(t, lastEnd)
    return t
  }

  function seekPreviewToPlayhead (force = false) {
    const t = opts.playhead()
    const blend = getBlendAtTime(opts.clips(), 'video', t)
    const el = videoEl.value

    if (blend && videoElB.value) {
      applyBlendToPreview(blend)
      activeClipId.value = blend.mix < 0.5 ? blend.outgoing.id : blend.incoming.id
      seekAudioToPlayhead(force)
      syncVideoMuteForPlayhead()
      return
    }

    applyBlendToPreview(null)

    const clip = findClipAtTime(opts.clips(), 'video', t)
    if (!clip || !el) return

    const target = localSourceTime(clip, t)
    if (activeClipId.value !== clip.id) {
      activeClipId.value = clip.id
      ensureClipOnElement(el, clip, clip.id)
      el.style.opacity = '1'
    }
    if (videoElB.value) {
      videoElB.value.style.opacity = '0'
      videoElB.value.pause()
    }

    if (isScrubbing.value) {
      el.pause()
    }

    seekElement(el, target, force || isScrubbing.value)
    seekAudioToPlayhead(force)
    resumePreviewPlayback()
  }

  function scheduleSeek () {
    if (pendingSeekRaf != null) return
    pendingSeekRaf = requestAnimationFrame(() => {
      pendingSeekRaf = null
      seekPreviewToPlayhead(true)
    })
  }

  watch(
    () => [opts.playhead(), opts.clips().map(c => `${c.id}:${c.timelineStart}`).join('|')],
    () => {
      if (!opts.isPlaying() && !isScrubbing.value) scheduleSeek()
    }
  )

  function beginScrub () {
    if (opts.isPlaying()) {
      opts.setPlaying(false)
      videoEl.value?.pause()
      videoElB.value?.pause()
      audioEl.value?.pause()
    }
    isScrubbing.value = true
    seekPreviewToPlayhead(true)
    seekAudioToPlayhead(true)
  }

  function endScrub () {
    isScrubbing.value = false
  }

  function advancePlayheadByDelta (dt: number): boolean {
    let next = opts.playhead() + dt
    if (next >= opts.duration()) {
      opts.setPlayhead(opts.duration())
      return false
    }
    next = snapPlayheadOverGaps(next)
    const lastVideo = sortedVideoClips().at(-1)
    const lastAudio = sortedAudioClips().at(-1)
    const lastEnd = Math.max(
      lastVideo ? clipTimelineEnd(lastVideo) : 0,
      lastAudio ? clipTimelineEnd(lastAudio) : 0
    )
    if (lastEnd > 0 && next >= lastEnd - 0.001) {
      opts.setPlayhead(opts.duration())
      return false
    }
    opts.setPlayhead(next)
    return true
  }

  function tick (now: number) {
    if (!opts.isPlaying()) return
    const el = videoEl.value
    if (!el) {
      stop()
      return
    }

    if (lastTick.value) {
      const dt = (now - lastTick.value) / 1000
      if (!advancePlayheadByDelta(dt)) {
        stop()
        return
      }
    }
    lastTick.value = now

    const t = opts.playhead()
    const blend = getBlendAtTime(opts.clips(), 'video', t)
    if (blend && videoElB.value) {
      applyBlendToPreview(blend)
      seekAudioToPlayhead(false)
    } else {
      seekPreviewToPlayhead(false)
      if (!findClipAtTime(opts.clips(), 'video', t)) {
        const upcoming = sortedVideoClips().find(c => c.timelineStart >= t - 0.001)
        if (upcoming) {
          opts.setPlayhead(upcoming.timelineStart)
          seekPreviewToPlayhead(false)
        } else {
          stop()
          return
        }
      }
    }

    rafId.value = requestAnimationFrame(tick)
  }

  function play () {
    let clip = findClipAtTime(opts.clips(), 'video', opts.playhead())
    if (!clip) {
      const sorted = opts
        .clips()
        .filter(c => c.track === 'video')
        .sort((a, b) => a.timelineStart - b.timelineStart)
      clip = sorted[0] ?? null
      if (clip) opts.setPlayhead(clip.timelineStart)
    }
    if (!clip) return
    seekPreviewToPlayhead(true)
    opts.setPlaying(true)
    lastTick.value = 0
    isScrubbing.value = false
    syncVideoMuteForPlayhead()
    videoEl.value?.play().catch(() => opts.setPlaying(false))
    videoElB.value?.play().catch(() => {})
    seekAudioToPlayhead(true)
    rafId.value = requestAnimationFrame(tick)
  }

  function pause () {
    stop()
    videoEl.value?.pause()
    videoElB.value?.pause()
    audioEl.value?.pause()
  }

  function stop () {
    opts.setPlaying(false)
    lastTick.value = 0
    if (rafId.value != null) {
      cancelAnimationFrame(rafId.value)
      rafId.value = null
    }
  }

  function togglePlay () {
    if (opts.isPlaying()) pause()
    else play()
  }

  watch(activeVideoClip, () => {
    if (opts.isPlaying()) return
    if (!isScrubbing.value) scheduleSeek()
  })

  onUnmounted(() => {
    stop()
    if (pendingSeekRaf != null) cancelAnimationFrame(pendingSeekRaf)
  })

  return {
    videoEl,
    videoElB,
    isScrubbing,
    activeVideoClip,
    blendPreview,
    bindVideo,
    bindAudio,
    seekPreviewToPlayhead,
    seekAudioToPlayhead,
    beginScrub,
    endScrub,
    scheduleSeek,
    play,
    pause,
    togglePlay,
    stop
  }
}
