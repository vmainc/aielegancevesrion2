/** Canonical character turnaround views for lookbooks and generation refs. */

export const CHARACTER_TURNAROUND_VIEWS = [
  { id: 'front', label: 'Front', hint: 'Facing camera — green-screen turnaround plate' },
  { id: 'back', label: 'Back', hint: 'From behind' },
  { id: 'left', label: 'Left', hint: 'Left profile / side' },
  { id: 'right', label: 'Right', hint: 'Right profile / side' }
] as const

export type CharacterTurnaroundViewId = (typeof CHARACTER_TURNAROUND_VIEWS)[number]['id']

export function characterTurnaroundLabel (view: CharacterTurnaroundViewId): string {
  return CHARACTER_TURNAROUND_VIEWS.find((v) => v.id === view)?.label || view
}

/** True when the plate is a close-up identity still (lookbook hero), not a turnaround slot. */
export function isCharacterHeadshotLabel (raw: string | null | undefined): boolean {
  const t = (raw || '').trim().toLowerCase()
  return Boolean(t && /\bhead\s*shot\b|\bheadshot\b|\bclose[\s-]?up\b|\bportrait\b/.test(t))
}

/** Map freeform expression labels (legacy) onto a turnaround view. */
export function parseCharacterTurnaroundView (
  raw: string | null | undefined
): CharacterTurnaroundViewId | null {
  const t = (raw || '').trim().toLowerCase()
  if (!t) return null
  // Headshots are the lookbook hero — never treat them as the Front turnaround slot.
  if (isCharacterHeadshotLabel(t)) return null
  if (/\bfront\b|facing\s*camera|frontal|face[\s-]?on/.test(t)) return 'front'
  if (/\bback\b|\brear\b|from\s*behind|dorsal/.test(t)) return 'back'
  if (/\bleft\b/.test(t)) return 'left'
  if (/\bright\b/.test(t)) return 'right'
  return null
}

export function expressionLabelFromPlateMeta (meta: Record<string, unknown>): string {
  const v = meta.expression_label ?? meta.emotion
  return typeof v === 'string' ? v.trim() : ''
}

/** Lower is better for generation / primary portrait. Labeled headshot first, then featured, then Front. */
export function characterPlateRank (meta: Record<string, unknown>): number {
  const label = expressionLabelFromPlateMeta(meta)
  // Headshot must beat "featured" so an older featured turnaround never steals face lock.
  if (isCharacterHeadshotLabel(label)) return 0
  if (meta.featured === true) return 1
  const view = parseCharacterTurnaroundView(label)
  if (view === 'front') return 2
  if (view === 'back') return 3
  if (view === 'left') return 4
  if (view === 'right') return 5
  return 6
}

export function characterTurnaroundViewOrder (view: CharacterTurnaroundViewId): number {
  return CHARACTER_TURNAROUND_VIEWS.findIndex((v) => v.id === view)
}
