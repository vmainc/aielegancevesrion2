import type { CreativeCharacter } from '~/types/creative-project'

/**
 * Fallback when a slice has no color (shouldn’t happen) — also used by `CharacterScreenSharePie` legend fallback.
 * @deprecated Prefer per-slice `rainbowSliceColor` from `buildCharacterPieModel`.
 */
export const SCREEN_SHARE_PIE_PALETTE = [
  '#e53935',
  '#fb8c00',
  '#fdd835',
  '#43a047',
  '#1e88e5',
  '#8e24aa',
  '#d81b60',
  '#00acc1',
  '#6d4c41',
  '#7cb342',
  '#5e35b1',
  '#ff7043'
] as const

const NOT_IN_CHART_GRAY = '#d1d5db'

/** Distinct rainbow hues spaced across the circle (OK for any slice count). */
export function rainbowSliceColor (index: number, total: number): string {
  const n = Math.max(1, total)
  const h = Math.round((360 * index) / n) % 360
  return `hsl(${h} 78% 52%)`
}

export interface CharacterPieSlice {
  label: string
  percent: number
  color: string
}

export interface CharacterPieModel {
  /** Slices passed to the pie chart (percent > 0 only in legend). */
  slices: CharacterPieSlice[]
  /** Lowercase character name → hex (matches pie segment, or gray if not shown). */
  colorByCharacterName: Map<string, string>
}

/**
 * Build pie slices + per-character colors for the dialogue / presence share chart.
 * Mirrors the previous page logic, with explicit colors on every slice.
 */
export function buildCharacterPieModel (list: CreativeCharacter[]): CharacterPieModel {
  const colorByCharacterName = new Map<string, string>()

  if (!list.length) {
    return { slices: [], colorByCharacterName }
  }

  type Raw = { label: string; percent: number; otherMembers?: string[] }
  let slicesRaw: Raw[] = []

  const withPct = list
    .map(c => ({
      label: c.name,
      percent: c.screenSharePercent ?? 0
    }))
    .filter(s => s.percent > 0)

  if (!withPct.length) {
    const eq = 100 / list.length
    slicesRaw = list.map((c, i) => ({
      label: c.name,
      percent: Math.round((i === list.length - 1 ? 100 - eq * (list.length - 1) : eq) * 10) / 10
    }))
  } else if (withPct.length <= 10) {
    slicesRaw = withPct.map(s => ({ label: s.label, percent: s.percent }))
  } else {
    const sorted = [...withPct].sort((a, b) => b.percent - a.percent)
    const main: Raw[] = []
    const otherMembers: string[] = []
    let other = 0
    const threshold = 2
    for (const s of sorted) {
      if (s.percent < threshold && sorted.length > 6) {
        other += s.percent
        otherMembers.push(s.label)
      } else {
        main.push({ label: s.label, percent: s.percent })
      }
    }
    if (other > 0) {
      main.push({
        label: 'Other (smaller roles)',
        percent: Math.round(other * 10) / 10,
        otherMembers
      })
    }
    slicesRaw = main
  }

  const nSlices = slicesRaw.length
  const slices: CharacterPieSlice[] = slicesRaw.map((s, i) => ({
    label: s.label,
    percent: s.percent,
    color: rainbowSliceColor(i, nSlices)
  }))

  for (let i = 0; i < slicesRaw.length; i++) {
    const sr = slicesRaw[i]!
    const color = slices[i]!.color
    if (sr.label === 'Other (smaller roles)' && sr.otherMembers?.length) {
      for (const n of sr.otherMembers) {
        colorByCharacterName.set(n.trim().toLowerCase(), color)
      }
    } else {
      colorByCharacterName.set(sr.label.trim().toLowerCase(), color)
    }
  }

  for (const c of list) {
    const k = c.name.trim().toLowerCase()
    if (!colorByCharacterName.has(k)) {
      colorByCharacterName.set(k, NOT_IN_CHART_GRAY)
    }
  }

  return { slices, colorByCharacterName }
}

export function pieModelToSwatchRecord (model: CharacterPieModel): Record<string, string> {
  return Object.fromEntries(model.colorByCharacterName.entries())
}
