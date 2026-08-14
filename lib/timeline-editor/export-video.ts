import { getBlendAtTime } from '~/lib/timeline-editor/blend'
import { findClipAtTime, clipsOnTrack } from '~/lib/timeline-editor/clip-ops'
import {
  type TimelineExportQualityId,
  timelineExportQualityPreset
} from '~/lib/timeline-editor/export-quality'
import { clipTimelineEnd } from '~/lib/timeline-editor/geometry'
import { applyCrossOriginForMediaSrc } from '~/lib/timeline-editor/media-cross-origin'
import type { TimelineEditorClip } from '~/types/timeline-editor'

export type TimelineExportProgress = {
  phase: 'prepare' | 'recording' | 'finalize'
  progress: number
  message: string
}

export type TimelineExportPreviewElements = {
  videoA: HTMLVideoElement
  videoB: HTMLVideoElement
  audio: HTMLAudioElement
}

export type TimelineExportOptions = {
  clips: TimelineEditorClip[]
  duration: number
  resolveSrc: (raw: string) => string
  preview: TimelineExportPreviewElements
  setPlayhead: (t: number) => void
  seekPreview: (force?: boolean) => void
  /** Use the same playback engine as the preview (videos stay decoded). */
  startPlayback: () => void
  stopPlayback: () => void
  getPlayhead: () => number
  getIsPlaying: () => boolean
  /** 720p / 1080p — sets canvas size and bitrate unless width/height/bitrate override. */
  quality?: TimelineExportQualityId
  exportWidth?: number
  exportHeight?: number
  videoBitsPerSecond?: number
  frameRate?: number
  onProgress?: (p: TimelineExportProgress) => void
}

/** Preload the incoming clip on videoB before a cut so handoff does not flash black. */
const CUT_PRELOAD_SEC = 0.4

function unwrapMediaRef<T extends HTMLMediaElement> (el: T | { value: T | null } | null): T | null {
  if (!el) return null
  if (typeof el === 'object' && 'value' in el) {
    return (el as { value: T | null }).value
  }
  return el
}

function pickRecorderMime (): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ]
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  throw new Error('Video export is not supported in this browser (WebM recording unavailable). Try Chrome or Edge.')
}

function localSourceTime (clip: TimelineEditorClip, timelineT: number): number {
  const local = timelineT - clip.timelineStart
  return clip.sourceStart + Math.max(0, Math.min(local, clip.duration - 0.001))
}

function resolveAudioClipAtTime (clips: TimelineEditorClip[], t: number): TimelineEditorClip | null {
  const onTrack = findClipAtTime(clips, 'audio', t)
  if (onTrack) return onTrack
  const video = findClipAtTime(clips, 'video', t)
  if (video?.linkedAudioId) {
    return clips.find(c => c.id === video.linkedAudioId) ?? null
  }
  return null
}

function ensureClipOnElement (
  el: HTMLVideoElement | HTMLAudioElement,
  clip: TimelineEditorClip,
  clipKey: string,
  resolveSrc: (raw: string) => string
) {
  const src = resolveSrc(clip.src)
  applyCrossOriginForMediaSrc(el, src)
  if (el.src === src && el.dataset.clipId !== clipKey) {
    el.dataset.clipId = clipKey
    return
  }
  if (el.dataset.clipId !== clipKey || el.src !== src) {
    el.dataset.clipId = clipKey
    el.src = src
    el.load()
  }
}

function seekMedia (el: HTMLVideoElement | HTMLAudioElement, seconds: number, force = false) {
  if (!force && Math.abs(el.currentTime - seconds) < 0.04) return
  try {
    el.currentTime = seconds
  } catch {
    /* ignore */
  }
}

function videoClipsActiveAtTime (clips: TimelineEditorClip[], t: number): TimelineEditorClip[] {
  return clipsOnTrack(clips, 'video').filter(
    c => t >= c.timelineStart - 0.001 && t < clipTimelineEnd(c) + 0.001
  )
}

function nextVideoClipAfter (
  clips: TimelineEditorClip[],
  clip: TimelineEditorClip | null
): TimelineEditorClip | null {
  const ordered = clipsOnTrack(clips, 'video')
  if (!clip) return ordered[0] ?? null
  const idx = ordered.findIndex(c => c.id === clip.id)
  return idx >= 0 ? ordered[idx + 1] ?? null : null
}

function clipLoadedOnElement (el: HTMLVideoElement, clip: TimelineEditorClip, resolveSrc: (raw: string) => string): boolean {
  return el.dataset.clipId === clip.id && el.src === resolveSrc(clip.src)
}

function clipReadyOnElement (
  el: HTMLVideoElement,
  clip: TimelineEditorClip,
  resolveSrc: (raw: string) => string
): boolean {
  return clipLoadedOnElement(el, clip, resolveSrc) && el.readyState >= 2 && el.videoWidth > 0
}

/** Preload the incoming clip on videoB before a hard cut (playback keeps videoA running). */
function preloadUpcomingCutOnB (
  clips: TimelineEditorClip[],
  t: number,
  resolveSrc: (raw: string) => string,
  videoB: HTMLVideoElement
) {
  if (getBlendAtTime(clips, 'video', t)) return
  const primary = findClipAtTime(clips, 'video', t)
  if (!primary) return
  const next = nextVideoClipAfter(clips, primary)
  if (!next) return
  const timeToCut = clipTimelineEnd(primary) - t
  if (timeToCut <= 0 || timeToCut > CUT_PRELOAD_SEC) return
  ensureClipOnElement(videoB, next, next.id, resolveSrc)
  seekMedia(videoB, localSourceTime(next, Math.max(t, next.timelineStart)), true)
}

function drawVideoFit (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number
): boolean {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh || video.readyState < 2) return false
  const scale = Math.min(w / vw, h / vh)
  const dw = vw * scale
  const dh = vh * scale
  ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh)
  return true
}

function waitForMediaReady (el: HTMLVideoElement, timeoutMs = 10_000): Promise<void> {
  if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && el.videoWidth > 0) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timed out loading clip media for export'))
    }, timeoutMs)
    const done = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error('Could not load a clip for export (check network or try again)'))
    }
    const cleanup = () => {
      window.clearTimeout(timer)
      el.removeEventListener('loadeddata', done)
      el.removeEventListener('canplay', done)
      el.removeEventListener('error', onErr)
    }
    el.addEventListener('loadeddata', done, { once: true })
    el.addEventListener('canplay', done, { once: true })
    el.addEventListener('error', onErr, { once: true })
    void el.play().catch(() => {})
  })
}

function createHiddenAudioElement (): HTMLAudioElement {
  const audioEl = document.createElement('audio')
  audioEl.preload = 'auto'
  audioEl.style.cssText = 'position:fixed;left:-9999px;opacity:0;pointer-events:none'
  document.body.appendChild(audioEl)
  return audioEl
}

function createHiddenVideoForAudio (): HTMLVideoElement {
  const v = document.createElement('video')
  v.playsInline = true
  v.preload = 'auto'
  v.muted = false
  v.volume = 1
  v.style.cssText =
    'position:fixed;left:0;top:0;width:640px;height:360px;opacity:0.001;pointer-events:none;z-index:-1'
  document.body.appendChild(v)
  return v
}

function syncHiddenAudioAtTime (
  clips: TimelineEditorClip[],
  resolveSrc: (raw: string) => string,
  t: number,
  exportAudio: HTMLAudioElement,
  exportVideoAudio: HTMLVideoElement,
  lastKey: { value: string }
) {
  const audioClip = resolveAudioClipAtTime(clips, t)
  const video = findClipAtTime(clips, 'video', t)
  const useEmbedded = Boolean(video?.hasAudio && !video.linkedAudioId && !audioClip)

  const key = audioClip
    ? `a:${audioClip.id}`
    : useEmbedded && video
      ? `v:${video.id}`
      : 'none'

  if (key === lastKey.value) return key === 'none' ? 'none' as const : (audioClip ? 'audio' as const : 'embedded' as const)

  lastKey.value = key
  exportAudio.pause()
  exportVideoAudio.pause()

  if (audioClip) {
    ensureClipOnElement(exportAudio, audioClip, audioClip.id, resolveSrc)
    seekMedia(exportAudio, localSourceTime(audioClip, t))
    void exportAudio.play().catch(() => {})
    return 'audio' as const
  }

  if (useEmbedded && video) {
    ensureClipOnElement(exportVideoAudio, video, `audio:${video.id}`, resolveSrc)
    seekMedia(exportVideoAudio, localSourceTime(video, t))
    void exportVideoAudio.play().catch(() => {})
    return 'embedded' as const
  }

  return 'none' as const
}

function drawExportFrame (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement,
  blend: ReturnType<typeof getBlendAtTime>,
  clips: TimelineEditorClip[],
  t: number,
  resolveSrc: (raw: string) => string
): boolean {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)

  let drew = false
  if (blend) {
    ctx.globalAlpha = 1 - blend.mix
    drew = drawVideoFit(ctx, videoA, w, h) || drew
    ctx.globalAlpha = blend.mix
    drew = drawVideoFit(ctx, videoB, w, h) || drew
    ctx.globalAlpha = 1
    return drew
  }

  const primary =
    videoClipsActiveAtTime(clips, t).at(-1) ?? findClipAtTime(clips, 'video', t)
  drew = drawVideoFit(ctx, videoA, w, h)
  if (!drew && primary && clipReadyOnElement(videoB, primary, resolveSrc)) {
    drew = drawVideoFit(ctx, videoB, w, h)
  }
  return drew
}

function exportEndTime (clips: TimelineEditorClip[], duration: number): number {
  const lastVideo = clipsOnTrack(clips, 'video').at(-1)
  const lastAudio = clipsOnTrack(clips, 'audio').at(-1)
  const lastEnd = Math.max(
    lastVideo ? clipTimelineEnd(lastVideo) : 0,
    lastAudio ? clipTimelineEnd(lastAudio) : 0
  )
  return Math.min(duration, Math.max(lastEnd, 0.1))
}

function enableExportCrossOrigin (preview: TimelineExportPreviewElements) {
  for (const el of [preview.videoA, preview.videoB, preview.audio]) {
    try {
      const src = el.currentSrc || el.src
      if (src) applyCrossOriginForMediaSrc(el, src)
    } catch {
      /* ignore */
    }
  }
}

function recordWhilePlaying (
  opts: TimelineExportOptions,
  endTime: number,
  resolveSrc: (raw: string) => string,
  exportAudio: HTMLAudioElement,
  exportVideoAudio: HTMLVideoElement
): Promise<Blob> {
  const { preview } = opts
  const preset = timelineExportQualityPreset(opts.quality)
  const w = opts.exportWidth ?? preset.width
  const h = opts.exportHeight ?? preset.height
  const fps = opts.frameRate ?? preset.frameRate
  const videoBitsPerSecond = opts.videoBitsPerSecond ?? preset.videoBitsPerSecond
  const mime = pickRecorderMime()

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return Promise.reject(new Error('Could not create export canvas'))

  const audioCtx = new AudioContext()
  const dest = audioCtx.createMediaStreamDestination()
  const exportAudioGain = audioCtx.createGain()
  const exportVideoAudioGain = audioCtx.createGain()

  audioCtx.createMediaElementSource(exportAudio).connect(exportAudioGain)
  audioCtx.createMediaElementSource(exportVideoAudio).connect(exportVideoAudioGain)
  exportAudioGain.connect(dest)
  exportVideoAudioGain.connect(dest)

  const combined = new MediaStream([
    ...canvas.captureStream(fps).getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ])

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond })
  const audioKey = { value: '' }

  const holdCanvas = document.createElement('canvas')
  holdCanvas.width = w
  holdCanvas.height = h
  const holdCtx = holdCanvas.getContext('2d', { alpha: false })

  return new Promise((resolve, reject) => {
    let drewAnyFrame = false
    let settled = false
    const wallDeadline = performance.now() + (endTime + 20) * 1000

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      opts.stopPlayback()
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        /* ignore */
      }
      void audioCtx.close()
      reject(err)
    }

    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data)
    }
    recorder.onerror = () => fail(new Error('Recording failed'))
    recorder.onstop = () => {
      if (settled) return
      settled = true
      void audioCtx.close()
      if (!drewAnyFrame) {
        reject(new Error('Export produced no video frames. Save clips to Assets → Video, reload, and try again.'))
        return
      }
      resolve(new Blob(chunks, { type: mime.split(';')[0] || 'video/webm' }))
    }

    void (async () => {
      try {
        await audioCtx.resume()
        recorder.start(500)
        opts.onProgress?.({ phase: 'recording', progress: 0, message: 'Recording timeline…' })
        opts.setPlayhead(0)
        opts.seekPreview(true)
        await waitForMediaReady(preview.videoA, 15_000)
        opts.startPlayback()
        await waitForMediaReady(preview.videoA, 15_000)

        const frame = () => {
          if (settled) return

          if (performance.now() > wallDeadline) {
            fail(new Error('Export timed out'))
            return
          }

          const t = opts.getPlayhead()
          preloadUpcomingCutOnB(opts.clips, t, resolveSrc, preview.videoB)
          const blend = getBlendAtTime(opts.clips, 'video', t)

          const audioMode = syncHiddenAudioAtTime(
            opts.clips,
            resolveSrc,
            t,
            exportAudio,
            exportVideoAudio,
            audioKey
          )
          exportAudioGain.gain.value = audioMode === 'audio' ? 1 : 0
          exportVideoAudioGain.gain.value = audioMode === 'embedded' ? 1 : 0

          try {
            let drew = drawExportFrame(
              ctx,
              w,
              h,
              preview.videoA,
              preview.videoB,
              blend,
              opts.clips,
              t,
              resolveSrc
            )
            if (drew) {
              drewAnyFrame = true
              holdCtx?.drawImage(canvas, 0, 0)
            } else if (drewAnyFrame && holdCtx) {
              ctx.drawImage(holdCanvas, 0, 0)
            }
          } catch {
            fail(new Error('Could not draw clip frames (cross-origin media). Save clips to Assets → Video and retry.'))
            return
          }

          opts.onProgress?.({
            phase: 'recording',
            progress: endTime > 0 ? Math.min(1, t / endTime) : 1,
            message: `Recording… ${Math.floor(t)}s / ${Math.ceil(endTime)}s`
          })

          const playbackDone = drewAnyFrame && !opts.getIsPlaying() && t > 0.2
          if (t >= endTime - 0.05 || playbackDone) {
            opts.onProgress?.({ phase: 'finalize', progress: 1, message: 'Finalizing file…' })
            opts.stopPlayback()
            recorder.stop()
            return
          }

          requestAnimationFrame(frame)
        }

        requestAnimationFrame(frame)
      } catch (e: unknown) {
        fail(e instanceof Error ? e : new Error('Export failed'))
      }
    })()
  })
}

/** Record timeline playback to WebM (matches preview). */
export async function exportTimelineToVideo (opts: TimelineExportOptions): Promise<Blob> {
  if (!import.meta.client) {
    throw new Error('Export is only available in the browser')
  }
  if (!opts.clips.some(c => c.track === 'video')) {
    throw new Error('Add at least one video clip to export')
  }

  const exportAudio = createHiddenAudioElement()
  const exportVideoAudio = createHiddenVideoForAudio()

  const preview = {
    videoA: unwrapMediaRef(opts.preview.videoA)!,
    videoB: unwrapMediaRef(opts.preview.videoB)!,
    audio: unwrapMediaRef(opts.preview.audio)!
  }
  if (!preview.videoA || !preview.videoB || !preview.audio) {
    throw new Error('Preview not ready — wait a moment and try again.')
  }

  try {
    opts.onProgress?.({ phase: 'prepare', progress: 0, message: 'Preparing export…' })
    enableExportCrossOrigin(preview)

    // Force preview to reload clips (picks up crossOrigin for canvas drawImage).
    delete preview.videoA.dataset.clipId
    delete preview.videoB.dataset.clipId

    opts.setPlayhead(0)
    opts.seekPreview(true)
    await waitForMediaReady(preview.videoA)

    const endTime = exportEndTime(opts.clips, opts.duration)
    return await recordWhilePlaying(
      { ...opts, preview },
      endTime,
      opts.resolveSrc,
      exportAudio,
      exportVideoAudio
    )
  } finally {
    opts.stopPlayback()
    exportAudio.pause()
    exportVideoAudio.pause()
    exportAudio.remove()
    exportVideoAudio.remove()
  }
}

export function downloadTimelineExport (blob: Blob, filename: string) {
  const safe = filename.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'timeline-export.webm'
  const name = safe.endsWith('.webm') ? safe : `${safe}.webm`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function defaultTimelineExportFilename (projectId: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `timeline-${projectId.slice(0, 8)}-${stamp}.webm`
}
