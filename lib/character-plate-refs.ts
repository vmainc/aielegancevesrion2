import { isCharacterPortraitAsset } from '~/lib/character-voice-assets'
import {
  CHARACTER_TURNAROUND_VIEWS,
  characterPlateRank,
  expressionLabelFromPlateMeta,
  parseCharacterTurnaroundView,
  type CharacterTurnaroundViewId
} from '~/lib/character-turnaround-views'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

export type CharacterPlateBundle = {
  /** Front (or best) plate — primary identity lock. */
  url: string
  notes: string
  promptUsed: string
  /** Turnaround plates in front → back → left → right order when labeled. */
  plateUrls: string[]
}

type RankedPlate = {
  url: string
  notes: string
  promptUsed: string
  featured: boolean
  ts: string
  rank: number
  view: CharacterTurnaroundViewId | null
}

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

function promptUsedFromMeta (meta: Record<string, unknown>): string {
  if (typeof meta.prompt_used === 'string') return meta.prompt_used.trim()
  if (typeof meta.promptUsed === 'string') return meta.promptUsed.trim()
  return ''
}

function sortPlates (a: RankedPlate, b: RankedPlate): number {
  if (a.rank !== b.rank) return a.rank - b.rank
  return (b.ts || '').localeCompare(a.ts || '')
}

/**
 * Prefer one plate per turnaround view (front/back/left/right), front as primary.
 * Falls back to ranked freeform plates when views are missing.
 */
function bundleFromPlates (plates: RankedPlate[], maxPlates: number): CharacterPlateBundle | null {
  if (!plates.length) return null
  const sorted = [...plates].sort(sortPlates)

  const byView = new Map<CharacterTurnaroundViewId, RankedPlate>()
  for (const p of sorted) {
    if (!p.view || byView.has(p.view)) continue
    byView.set(p.view, p)
  }

  const urls: string[] = []
  const seen = new Set<string>()
  const pushUrl = (u: string) => {
    const url = (u || '').trim()
    if (!url || seen.has(url)) return
    seen.add(url)
    urls.push(url)
  }

  for (const v of CHARACTER_TURNAROUND_VIEWS) {
    const plate = byView.get(v.id)
    if (plate) pushUrl(plate.url)
    if (urls.length >= maxPlates) break
  }

  if (urls.length < maxPlates) {
    for (const p of sorted) {
      pushUrl(p.url)
      if (urls.length >= maxPlates) break
    }
  }

  if (!urls.length && !sorted[0]!.notes && !sorted[0]!.promptUsed) return null

  const front = byView.get('front')
  const primary = front || sorted[0]!
  return {
    url: (front?.url || urls[0] || primary.url || '').trim(),
    notes: primary.notes,
    promptUsed: primary.promptUsed,
    plateUrls: urls
  }
}

/**
 * Build featured + turnaround plate bundles for each cast member from `kind: character` assets.
 */
export function buildCharacterPlateMap (
  characters: Array<Pick<CreativeCharacter, 'id' | 'name'>>,
  assets: ProjectAsset[],
  resolveUrl: (asset: ProjectAsset) => string,
  maxPlatesPerCharacter = 4
): Map<string, CharacterPlateBundle> {
  const byCharacterId: Record<string, RankedPlate[]> = {}
  const byCharacterName: Record<string, RankedPlate[]> = {}

  for (const a of assets) {
    const meta = (a.metadata && typeof a.metadata === 'object')
      ? (a.metadata as Record<string, unknown>)
      : {}
    if (!isCharacterPortraitAsset(meta)) continue
    const cid = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    const cname = typeof meta.character_name === 'string' ? normalizeName(meta.character_name) : ''
    const url = resolveUrl(a).trim()
    const notes = (a.notes || '').trim()
    const promptUsed = promptUsedFromMeta(meta)
    if (!url && !notes && !promptUsed) continue

    const label = expressionLabelFromPlateMeta(meta)
    const plate: RankedPlate = {
      url,
      notes,
      promptUsed,
      featured: meta.featured === true,
      ts: a.updated || a.created || '',
      rank: characterPlateRank(meta),
      view: parseCharacterTurnaroundView(label)
    }

    if (cid) {
      ;(byCharacterId[cid] ||= []).push(plate)
    }
    if (cname) {
      ;(byCharacterName[cname] ||= []).push(plate)
    }
  }

  const out = new Map<string, CharacterPlateBundle>()
  for (const c of characters) {
    const plates = byCharacterId[c.id] || byCharacterName[normalizeName(c.name)] || []
    const bundle = bundleFromPlates(plates, maxPlatesPerCharacter)
    if (bundle) out.set(c.id, bundle)
  }
  return out
}

/** Re-export rank helper for callers that imported it from this module. */
export { characterPlateRank } from '~/lib/character-turnaround-views'
