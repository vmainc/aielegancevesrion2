/** Probe source duration without modifying media (client-only). */
export function probeVideoDuration (src: string): Promise<number> {
  if (!import.meta.client || !src.trim()) return Promise.resolve(5)
  return new Promise((resolve) => {
    const el = document.createElement('video')
    el.preload = 'metadata'
    const done = (n: number) => {
      el.removeAttribute('src')
      el.load()
      resolve(Number.isFinite(n) && n > 0.25 ? n : 5)
    }
    el.onloadedmetadata = () => done(el.duration)
    el.onerror = () => done(5)
    el.src = src
  })
}

export async function applyProbedDurations (
  clips: import('~/types/timeline-editor').TimelineEditorClip[],
  resolveSrc: (raw: string) => string
): Promise<import('~/types/timeline-editor').TimelineEditorClip[]> {
  const out = [...clips]
  for (let i = 0; i < out.length; i++) {
    const c = out[i]!
    if (c.duration > 0.5 && c.sourceEnd > c.sourceStart + 0.5) continue
    const dur = await probeVideoDuration(resolveSrc(c.src))
    out[i] = {
      ...c,
      sourceStart: 0,
      sourceEnd: dur,
      duration: dur
    }
  }
  return out
}
