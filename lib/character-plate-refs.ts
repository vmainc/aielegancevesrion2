import { isCharacterPortraitAsset } from '~/lib/character-voice-assets'
import { isCostumePlateAsset } from '~/lib/costume-lock'
import {
  characterPlateRank,
  expressionLabelFromPlateMeta,
  isCharacterHeadshotLabel,
  parseCharacterTurnaroundView,
  type CharacterTurnaroundViewId
} from '~/lib/character-turnaround-views'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

export type CharacterPlateBundle = {
  /** Headshot when available, else Front — primary face/identity lock. */
  url: string
  notes: string
  promptUsed: string
  /** Face lock first (headshot), then turnarounds front → back → left → right. */
  plateUrls: string[]
}

type RankedPlate = {
  url: string
  notes: string
  promptUsed: string
  featured: boolean
  isHeadshot: boolean
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

/** Featured portrait or labeled headshot that is not a turnaround view — the face lock. */
function isIdentityFacePlate (plate: RankedPlate): boolean {
  return !plate.view && (plate.featured || plate.isHeadshot)
}

/** All turnaround slots stored in the lookbook (display / manual continuity). */
const GENERATION_VIEW_ORDER: CharacterTurnaroundViewId[] = ['front', 'left', 'right', 'back']

/**
 * Turnarounds sent to image/video models when a headshot exists.
 * Side/back AI plates often drift in face — attaching them tells the model to copy the wrong person.
 * Face lock stays on the headshot; Front optional for body/costume.
 */
const FACE_LOCK_REFERENCE_VIEW_ORDER: CharacterTurnaroundViewId[] = ['front']

/**
 * Featured headshot is the identity plate and is always included first.
 * Then one plate per turnaround view. Unlabeled extras fill only leftover slots.
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

  const identity = sorted.find(isIdentityFacePlate)
  if (identity) pushUrl(identity.url)

  const viewOrder = identity ? FACE_LOCK_REFERENCE_VIEW_ORDER : GENERATION_VIEW_ORDER
  for (const viewId of viewOrder) {
    if (urls.length >= maxPlates) break
    const plate = byView.get(viewId)
    if (plate) pushUrl(plate.url)
  }

  // With a headshot, do not pad with side/back turnarounds — they often drift and override the face lock.
  if (urls.length < maxPlates && !identity) {
    for (const p of sorted) {
      pushUrl(p.url)
      if (urls.length >= maxPlates) break
    }
  }

  if (!urls.length && !sorted[0]!.notes && !sorted[0]!.promptUsed) return null

  const front = byView.get('front')
  const primary = identity || front || sorted[0]!
  return {
    url: (primary.url || urls[0] || '').trim(),
    notes: primary.notes,
    promptUsed: primary.promptUsed,
    plateUrls: urls
  }
}

/** Instruction sent with bible plates so the image model copies the face. */
export function characterPlateIdentityNote (count: number): string {
  if (count <= 0) return ''
  const which = count === 1
    ? 'The attached portrait is the production bible plate'
    : `The attached ${count} portraits are the production bible plates`
  return [
    `CHARACTER PLATES (identity lock): ${which}.`,
    'The first plate is the face lock — copy that person exactly: same face, age, hair, and facial hair. Do not recast or redesign them.',
    'If a second character plate is attached, it is Front body/costume only — do not copy a different face from it. Clothing comes from the costume lock when one is set.',
    'Lookbook Left/Right/Back slots are not sent to generation when a headshot exists, so bad turnaround faces cannot override the headshot.',
    'If a plate is a scene still, keep the other people, the table, and the room. Do not erase them.',
    'If any written description disagrees with the plates, the plates win for the face and body. When COSTUME LOCK is present, that block wins for the clothes.',
    'Set and continuity images never change the face.'
  ].join(' ')
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
    if (!isCharacterPortraitAsset(meta) || isCostumePlateAsset(meta)) continue
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
      isHeadshot: isCharacterHeadshotLabel(label),
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
