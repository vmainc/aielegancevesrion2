import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { clipTimelineEnd } from '~/lib/timeline-editor/geometry'
import { findClipAtTime } from '~/lib/timeline-editor/clip-ops'
import { getBlendAtTime, type TimelineBlendFrame } from '~/lib/timeline-editor/blend'
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
  const isScrubbing = ref(false)
  const activeClipId = ref<string | null>(null)
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

  function localSourceTime (clip: TimelineEditorClip, timelineT: number): number {
    const local = timelineT - clip.timelineStart
    return clip.sourceStart + Math.max(0, Math.min(local, clip.duration - 0.001))
  }

  function ensureClipOnElement (el: HTMLVideoElement, clip: TimelineEditorClip, clipKey: string) {
    const src = opts.resolveSrc(clip.src)
    if (el.dataset.clipId !== clipKey || el.src !== src) {
      el.dataset.clipId = clipKey
      el.src = src
      el.load()
    }
  }

  function seekElement (el: HTMLVideoElement, seconds: number, force: boolean) {
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

  function seekPreviewToPlayhead (force = false) {
    const t = opts.playhead()
    const blend = getBlendAtTime(opts.clips(), 'video', t)
    const el = videoEl.value

    if (blend && videoElB.value) {
      applyBlendToPreview(blend)
      activeClipId.value = blend.mix < 0.5 ? blend.outgoing.id : blend.incoming.id
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

    if (isScrubbing.value || force) {
      el.pause()
    }

    seekElement(el, target, force || isScrubbing.value)
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
    }
    isScrubbing.value = true
    seekPreviewToPlayhead(true)
  }

  function endScrub () {
    isScrubbing.value = false
  }

  function tick (now: number) {
    if (!opts.isPlaying()) return
    const blend = getBlendAtTime(opts.clips(), 'video', opts.playhead())
    const el = videoEl.value
    if (!el) {
      stop()
      return
    }

    if (blend && videoElB.value) {
      applyBlendToPreview(blend)
      if (lastTick.value) {
        const dt = (now - lastTick.value) / 1000
        const next = opts.playhead() + dt
        if (next >= opts.duration()) {
          opts.setPlayhead(opts.duration())
          stop()
          return
        }
        opts.setPlayhead(next)
      }
      lastTick.value = now
      rafId.value = requestAnimationFrame(tick)
      return
    }

    const clip = activeVideoClip.value
    if (!clip) {
      stop()
      return
    }

    if (lastTick.value) {
      const dt = (now - lastTick.value) / 1000
      const next = opts.playhead() + dt
      if (next >= opts.duration()) {
        opts.setPlayhead(opts.duration())
        stop()
        return
      }
      opts.setPlayhead(next)
    }
    lastTick.value = now
    rafId.value = requestAnimationFrame(tick)
  }

  function play () {
    const clip = findClipAtTime(opts.clips(), 'video', opts.playhead())
    if (!clip) return
    seekPreviewToPlayhead(true)
    opts.setPlaying(true)
    lastTick.value = 0
    isScrubbing.value = false
    videoEl.value?.play().catch(() => opts.setPlaying(false))
    videoElB.value?.play().catch(() => {})
    rafId.value = requestAnimationFrame(tick)
  }

  function pause () {
    stop()
    videoEl.value?.pause()
    videoElB.value?.pause()
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
    if (!opts.isPlaying() && !isScrubbing.value) return
    scheduleSeek()
  })

  watch(
    () => opts.playhead(),
    (t) => {
      if (!opts.isPlaying()) return
      const clip = findClipAtTime(opts.clips(), 'video', t)
      if (!clip) return
      const end = clipTimelineEnd(clip)
      if (t >= end - 0.02) {
        const next = opts
          .clips()
          .filter(c => c.track === 'video')
          .sort((a, b) => a.timelineStart - b.timelineStart)
          .find(c => c.timelineStart >= end - 0.01 && c.id !== clip.id)
        if (next) opts.setPlayhead(next.timelineStart)
      }
    }
  )

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
    seekPreviewToPlayhead,
    beginScrub,
    endScrub,
    scheduleSeek,
    play,
    pause,
    togglePlay,
    stop
  }
}
