import { isCharacterPortraitAsset } from '~/lib/character-voice-assets'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

export type CharacterPlateBundle = {
  /** Featured (or best) plate — primary identity lock. */
  url: string
  notes: string
  promptUsed: string
  /** Featured + turnaround plates (Front / 3⁄4 / Profile / etc.), featured first. */
  plateUrls: string[]
}

type RankedPlate = {
  url: string
  notes: string
  promptUsed: string
  featured: boolean
  ts: string
  rank: number
}

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

function expressionLabelFromMeta (meta: Record<string, unknown>): string {
  const v = meta.expression_label ?? meta.emotion
  return typeof v === 'string' ? v.trim() : ''
}

/** Lower is better — featured first, then standard turnaround labels. */
export function characterPlateRank (meta: Record<string, unknown>): number {
  if (meta.featured === true) return 0
  const label = expressionLabelFromMeta(meta).toLowerCase()
  if (!label) return 5
  if (/^front\b/.test(label) || label === 'facing camera') return 1
  if (/3\s*[\/⁄-]\s*4|three[\s-]?quarter/.test(label)) return 2
  if (/profile|side/.test(label)) return 3
  return 4
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

function bundleFromPlates (plates: RankedPlate[], maxPlates: number): CharacterPlateBundle | null {
  if (!plates.length) return null
  const sorted = [...plates].sort(sortPlates)
  const urls: string[] = []
  const seen = new Set<string>()
  for (const p of sorted) {
    const u = (p.url || '').trim()
    if (!u || seen.has(u)) continue
    seen.add(u)
    urls.push(u)
    if (urls.length >= maxPlates) break
  }
  if (!urls.length && !sorted[0]!.notes && !sorted[0]!.promptUsed) return null
  const primary = sorted[0]!
  return {
    url: urls[0] || primary.url || '',
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

    const plate: RankedPlate = {
      url,
      notes,
      promptUsed,
      featured: meta.featured === true,
      ts: a.updated || a.created || '',
      rank: characterPlateRank(meta)
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
