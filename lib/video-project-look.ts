import type { ProjectDirector } from '~/types/creative-project'

export const VIDEO_PROJECT_LOOK_CONTINUITY_MARKER = 'CHARACTER CONTINUITY (mandatory'

/** Whether Director tab fields can steer generation prompts. */
export function projectDirectorHasLookGuidance (director: ProjectDirector | null | undefined): boolean {
  const d = director
  if (!d) return false
  return Boolean(
    d.style?.trim() ||
      d.tone?.trim() ||
      d.lighting_style?.trim() ||
      d.camera_preferences?.trim()
  )
}

export function summarizeDirectorLookForHint (director: ProjectDirector | null | undefined): string {
  const d = director
  if (!d) return ''
  const parts: string[] = []
  if (d.lighting_style?.trim()) parts.push(d.lighting_style.trim())
  else if (d.style?.trim()) parts.push(d.style.trim())
  if (parts.length) {
    const joined = parts.join(' · ')
    return joined.length > 120 ? `${joined.slice(0, 117).trimEnd()}…` : joined
  }
  if (d.tone?.trim()) return d.tone.trim().slice(0, 120)
  return ''
}

export type VideoProjectLookHintInput = {
  applyProjectLook: boolean
  director?: ProjectDirector | null
  hasProductionBibleContext?: boolean
  hasStoryboardStartFrame?: boolean
}

export function buildVideoProjectLookHint (input: VideoProjectLookHintInput): {
  show: boolean
  title: string
  detail: string
} {
  const directorOn = projectDirectorHasLookGuidance(input.director)
  const bibleOn = Boolean(input.hasProductionBibleContext)
  const frameNote = Boolean(input.hasStoryboardStartFrame)

  if (!input.applyProjectLook) {
    return {
      show: directorOn || bibleOn || frameNote,
      title: 'Project look is off for this clip',
      detail: [
        'Motion prompt omits cast continuity blocks; regenerating frames here skips Production Bible.',
        frameNote || directorOn
          ? 'Existing storyboard start/end frames may still look contrasty — they were baked when Director / storyboard image prompts ran. Re-generate on Storyboard (or upload a neutral still) for a flatter plate.'
          : 'Upload or generate a neutral start frame if you want a cleaner Seedance pass.'
      ].join(' ')
    }
  }

  const bits: string[] = []
  if (directorOn) {
    const snippet = summarizeDirectorLookForHint(input.director)
    bits.push(
      snippet
        ? `Director bible is active (lighting/style: ${snippet}).`
        : 'Director bible is active on this project.'
    )
  }
  if (bibleOn) bits.push('Production Bible facts can attach when you generate new frames here.')
  if (frameNote) {
    bits.push('Storyboard frames already carry that look into Seedance image-to-video.')
  } else if (directorOn) {
    bits.push('Storyboard image generation uses Director notes; this motion prompt stays motion-only.')
  }
  if (!bits.length) {
    return { show: false, title: '', detail: '' }
  }
  return {
    show: true,
    title: 'Project look is steering this clip',
    detail: bits.join(' ')
  }
}

/** Remove cast continuity block appended for video generation. */
export function stripProjectLookBlocksFromVideoPrompt (prompt: string): string {
  const base = prompt.trim()
  if (!base) return base
  const idx = base.toUpperCase().indexOf(VIDEO_PROJECT_LOOK_CONTINUITY_MARKER.toUpperCase())
  if (idx < 0) return base
  let cut = idx
  if (cut >= 2 && base.slice(cut - 2, cut) === '\n\n') cut -= 2
  return base.slice(0, cut).trim()
}

export function parseApplyProjectLookQuery (raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') return true
  const s = String(raw).trim().toLowerCase()
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false
  return true
}
