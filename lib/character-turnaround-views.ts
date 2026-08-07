/** Canonical character turnaround views for lookbooks and generation refs. */

export const CHARACTER_TURNAROUND_VIEWS = [
  { id: 'front', label: 'Front', hint: 'Facing camera — main identity plate' },
  { id: 'back', label: 'Back', hint: 'From behind' },
  { id: 'left', label: 'Left', hint: 'Left profile / side' },
  { id: 'right', label: 'Right', hint: 'Right profile / side' }
] as const

export type CharacterTurnaroundViewId = (typeof CHARACTER_TURNAROUND_VIEWS)[number]['id']

export function characterTurnaroundLabel (view: CharacterTurnaroundViewId): string {
  return CHARACTER_TURNAROUND_VIEWS.find((v) => v.id === view)?.label || view
}

/** Map freeform expression labels (legacy) onto a turnaround view. */
export function parseCharacterTurnaroundView (
  raw: string | null | undefined
): CharacterTurnaroundViewId | null {
  const t = (raw || '').trim().toLowerCase()
  if (!t) return null
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

/** Lower is better for generation / primary portrait. Front (or featured) first. */
export function characterPlateRank (meta: Record<string, unknown>): number {
  const view = parseCharacterTurnaroundView(expressionLabelFromPlateMeta(meta))
  if (view === 'front' || meta.featured === true) return 0
  if (view === 'back') return 1
  if (view === 'left') return 2
  if (view === 'right') return 3
  return 5
}

export function characterTurnaroundViewOrder (view: CharacterTurnaroundViewId): number {
  return CHARACTER_TURNAROUND_VIEWS.findIndex((v) => v.id === view)
}
