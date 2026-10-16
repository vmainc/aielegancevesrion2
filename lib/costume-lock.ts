import { formatCastNameForPrompt } from '~/lib/cast-name-convention'
import type { ProjectAsset } from '~/types/project-asset'

/** First look. Scene assignments never apply to it — it is the fallback. */
export const DEFAULT_COSTUME_ID = 'default'

/** Everyday outfit plus two changes. */
export const MAX_CHARACTER_COSTUMES = 3

export const COSTUME_PLATE_SOURCE = 'costume_plate'

export const COSTUME_LOCK_NEGATIVES =
  'redesigned costume, different outfit, changed wardrobe, swapped jacket, inconsistent clothing'

export interface CharacterCostume {
  id: string
  name: string
  description: string
  /** Scenes that wear this change instead of the everyday outfit. */
  sceneIds: string[]
}

function asRecord (value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function cleanSceneIds (value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const id of value) {
    if (typeof id !== 'string') continue
    const trimmed = id.trim()
    if (!trimmed || out.includes(trimmed)) continue
    out.push(trimmed)
  }
  return out
}

export function newCostumeId (): string {
  return `c_${Math.random().toString(36).slice(2, 10)}`
}

export function emptyCostume (id: string, name: string): CharacterCostume {
  return { id, name, description: '', sceneIds: [] }
}

function isBlankDefault (costume: CharacterCostume): boolean {
  const name = costume.name.trim().toLowerCase()
  return !costume.description.trim() &&
    !costume.sceneIds.length &&
    (name === '' || name === 'everyday' || name === 'default')
}

/** Keep at most three looks. The first is always the everyday outfit. */
export function normalizeCostumes (raw: unknown): CharacterCostume[] {
  if (!Array.isArray(raw)) return []
  const parsed: CharacterCostume[] = []
  for (const item of raw) {
    const row = asRecord(item)
    if (!row) continue
    const description = typeof row.description === 'string' ? row.description.trim().slice(0, 2000) : ''
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 80) : ''
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 40) : ''
    parsed.push({
      id,
      name,
      description,
      sceneIds: cleanSceneIds(row.sceneIds ?? row.scene_ids)
    })
    if (parsed.length >= MAX_CHARACTER_COSTUMES) break
  }
  if (!parsed.length) return []

  const first = parsed[0]!
  const rest = parsed.slice(1).filter((c) => c.description.trim() || c.name.trim() || c.sceneIds.length)
  const keepDefault = !isBlankDefault(first) || rest.length > 0
  if (!keepDefault) return []

  const usedScenes = new Set<string>()
  const alternates = rest.map((c) => {
    const sceneIds = c.sceneIds.filter((id) => {
      if (usedScenes.has(id)) return false
      usedScenes.add(id)
      return true
    })
    return {
      id: c.id || newCostumeId(),
      name: c.name || 'Change',
      description: c.description,
      sceneIds
    }
  })

  return [
    {
      id: DEFAULT_COSTUME_ID,
      name: first.name.trim() || 'Everyday',
      description: first.description,
      sceneIds: []
    },
    ...alternates
  ]
}

/** The look worn in this scene. Everyday is the fallback. */
export function resolveCostumeForScene (
  costumes: CharacterCostume[] | null | undefined,
  sceneId?: string
): CharacterCostume | null {
  const list = normalizeCostumes(costumes)
  if (!list.length) return null
  const sid = (sceneId || '').trim()
  if (sid) {
    const change = list.slice(1).find((c) => c.sceneIds.includes(sid))
    if (change) return change
  }
  return list[0] || null
}

export function activeCostumeId (
  costumes: CharacterCostume[] | null | undefined,
  sceneId?: string
): string {
  return resolveCostumeForScene(costumes, sceneId)?.id || DEFAULT_COSTUME_ID
}

export interface CostumeLockLine {
  characterName: string
  lookName: string
  description: string
}

export function buildCostumeLockPromptBlock (entries: CostumeLockLine[] | null | undefined): string {
  const lines = (entries || []).filter((e) => e.characterName.trim() && e.description.trim())
  if (!lines.length) return ''
  return [
    'COSTUME LOCK (clothes only — face and body stay the character lock):',
    ...lines.map((e) => {
      const who = formatCastNameForPrompt(e.characterName)
      const look = (e.lookName || 'Everyday').trim()
      return `- ${who} wears "${look}": ${e.description.replace(/\s+/g, ' ').trim().slice(0, 500)}`
    }),
    'Same garments, colors, layers, and condition whenever this look is worn. Do not redesign the outfit.',
    'This costume replaces any wardrobe mentioned in the appearance notes.',
    'If another line says to keep an earlier wardrobe, this costume lock wins.',
    'A costume plate, if attached, wins for the clothes. It does not replace the face.'
  ].join('\n')
}

const COSTUME_LOCK_BLOCK =
  /COSTUME LOCK \(clothes only[\s\S]*?does not replace the face\.\s*/gi

export function ensureCostumeLockInPrompt (prompt: string, block: string): string {
  const stripped = prompt.replace(COSTUME_LOCK_BLOCK, '').replace(/\n{3,}/g, '\n\n').trim()
  const extra = block.trim()
  if (!extra) return stripped
  return `${extra}\n\n${stripped}`
}

export function isCostumePlateAsset (metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  return metadata.source === COSTUME_PLATE_SOURCE
}

export function costumePlateMetadata (input: {
  characterId: string
  characterName: string
  costumeId: string
}): Record<string, unknown> {
  return {
    source: COSTUME_PLATE_SOURCE,
    character_id: input.characterId,
    character_name: input.characterName,
    costume_id: input.costumeId,
    featured: false
  }
}

export function costumePlateUrlsById (
  assets: ProjectAsset[],
  characterId: string,
  resolveUrl: (asset: ProjectAsset) => string
): Record<string, string> {
  const id = characterId.trim()
  const out: Record<string, string> = {}
  if (!id) return out
  for (const asset of assets) {
    const meta = asset.metadata && typeof asset.metadata === 'object'
      ? asset.metadata as Record<string, unknown>
      : {}
    if (!isCostumePlateAsset(meta)) continue
    const cid = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    if (cid !== id) continue
    const costumeId = typeof meta.costume_id === 'string' ? meta.costume_id.trim() : ''
    if (!costumeId || out[costumeId]) continue
    const url = resolveUrl(asset).trim()
    if (url) out[costumeId] = url
  }
  return out
}

export function selectCostumePlateUrls (
  characters: Array<{ costumes?: CharacterCostume[]; costumePlates?: Record<string, string> }>,
  sceneId: string | undefined,
  max = 2
): string[] {
  const urls: string[] = []
  for (const character of characters) {
    const costumeId = activeCostumeId(character.costumes, sceneId)
    const url = (character.costumePlates?.[costumeId] || '').trim()
    if (!url || urls.includes(url)) continue
    urls.push(url)
    if (urls.length >= max) break
  }
  return urls
}

export function buildCostumePlateReferenceNote (count: number): string {
  if (count <= 0) return ''
  const which = count === 1 ? 'The attached costume plate locks the clothes' : `The attached ${count} costume plates lock the clothes`
  return `${which}: same garments, colors, layers, and condition. Do not copy the face from a costume plate when a character plate is also attached. Do not redesign the outfit.`
}
