import type { ProjectTargetLength } from '~/types/creative-project'

/** User-facing labels for project scope / runtime. */
export const TARGET_LENGTH_OPTIONS: { value: ProjectTargetLength; label: string; hint: string }[] = [
  { value: 'spot', label: 'Spot / ad', hint: '~15–90s' },
  { value: 'short', label: 'Short / music video / web', hint: '~1–15 min' },
  { value: 'episode', label: 'Episode', hint: '~22–60 min' },
  { value: 'feature', label: 'Feature film', hint: '~90+ min' }
]

/** Instructions for the model so output scale matches intent. */
export function targetLengthModelGuidance (length: ProjectTargetLength | undefined): string {
  const v = length || 'short'
  const map: Record<ProjectTargetLength, string> = {
    spot:
      'Runtime target: about 15–90 seconds (commercial, bumper, short social). One core idea; minimal locations and characters; no feature-length subplots.',
    short:
      'Runtime target: about 1–15 minutes (music video, short film, web pilot). Keep scope tight; a few scenes; avoid full three-act feature sprawl.',
    episode:
      'Runtime target: about 22–60 minutes (TV/streaming episode). Room for B-stories and act breaks; still not a full theatrical feature.',
    feature:
      'Runtime target: about 90–120+ minutes (theatrical feature). Use full three-act structure; subplots and character arcs may be developed in proportion.'
  }
  return map[v] || map.short
}
