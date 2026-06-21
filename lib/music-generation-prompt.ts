/** Build Lyria prompt text for film score / theme generation. */
export function buildMusicGenerationPrompt (opts: {
  prompt: string
  instrumental: boolean
  lyrics?: string
  bpm?: number | null
}): string {
  const base = opts.prompt.trim()
  if (!base) return ''

  const lines: string[] = [base]

  if (typeof opts.bpm === 'number' && Number.isFinite(opts.bpm) && opts.bpm > 0) {
    lines.push(`Target tempo: approximately ${Math.round(opts.bpm)} BPM.`)
  }

  if (opts.instrumental) {
    lines.push(
      'Instrumental only — no vocals, no lyrics, no spoken word.',
      'Cinematic production quality suitable as a film score or theme bed.'
    )
  } else if (opts.lyrics?.trim()) {
    lines.push(`Lyrics to sing:\n${opts.lyrics.trim()}`)
  }

  lines.push('High-fidelity stereo mix, cohesive arrangement, no harsh clipping.')

  return lines.join('\n\n')
}

export const MUSIC_STYLE_PRESETS = [
  {
    label: 'Cinematic tension',
    text: 'Dark cinematic orchestral tension, low strings and subtle pulses, building slowly, film score underscore.'
  },
  {
    label: 'Warm theme',
    text: 'Warm uplifting orchestral theme, hopeful and emotional, suitable for a character moment or end credits.'
  },
  {
    label: 'Electronic pulse',
    text: 'Modern electronic score bed, steady rhythm, synth pads and muted bass, sci-fi thriller mood.'
  },
  {
    label: 'Gentle piano',
    text: 'Soft solo piano with light ambient texture, intimate and reflective, minimal and clean.'
  },
  {
    label: 'Action drive',
    text: 'High-energy action underscore, driving percussion and brass stabs, urgent but not chaotic.'
  }
] as const
