import { BIBLE_ASSET_ENTITY_METADATA_KEY, readAssetBridgeFields } from '~/lib/bible-cast-asset-bridge'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleRelationship } from '~/types/bible-relationship'
import type { ProjectAsset } from '~/types/project-asset'

/** Location owns the prop. `role` is the placement ("north wall", "center of the table"). */
export const DRESSED_WITH_RELATIONSHIP = 'dressed_with'

export const PROP_PLATE_SOURCE = 'prop_plate'

export const MAX_DRESSING_IN_PROMPT = 6
export const MAX_HERO_PROPS_IN_PROMPT = 4

export const PROP_LOCK_NEGATIVES =
  'redesigned hero prop, different television, different computer, swapped table, replaced furniture, inconsistent object design'

export const PROP_LOCK_RULES = [
  'Match each locked object: same shape, materials, color, and condition.',
  'A new angle is fine. The object may be held or moved.',
  'Do not invent a different TV, table, computer, or piece of furniture.'
].join(' ')

export interface LockedProp {
  entityId: string
  name: string
  aliases: string[]
  look: string
  description: string
  placement: string
  plateUrls: string[]
}

type PropEntity = Pick<BibleEntity, 'id' | 'type' | 'name' | 'summary' | 'description' | 'status' | 'aliases'>

type DressingRel = Pick<
  BibleRelationship,
  'id' | 'fromType' | 'fromId' | 'toType' | 'toId' | 'relationshipType' | 'role' | 'status'
>

export interface DressingEdge {
  relationshipId: string
  locationId: string
  propId: string
  placement: string
}

function escapeRegExp (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function isInactiveBibleStatus (status: string | undefined): boolean {
  return status === 'retired' || status === 'contradicted'
}

export function isPropPlateAsset (asset: ProjectAsset): boolean {
  const meta = asset.metadata && typeof asset.metadata === 'object' ? asset.metadata : {}
  const source = typeof meta.source === 'string' ? meta.source.trim() : ''
  return source === PROP_PLATE_SOURCE
}

export function propPlateMetadata (entityId: string, featured = true): Record<string, unknown> {
  return {
    source: PROP_PLATE_SOURCE,
    [BIBLE_ASSET_ENTITY_METADATA_KEY]: entityId,
    featured,
    prop_lock: true
  }
}

export function propPlateUrlsForEntity (
  entityId: string,
  assets: ProjectAsset[],
  playbackUrl?: (asset: ProjectAsset) => string
): string[] {
  const id = entityId.trim()
  if (!id) return []
  const urls: string[] = []
  const featured: string[] = []
  for (const a of assets) {
    if (!isPropPlateAsset(a)) continue
    const fields = readAssetBridgeFields(a.metadata)
    if (fields.bibleEntityId !== id) continue
    const url = (playbackUrl ? playbackUrl(a) : a.fileUrl || '').trim()
    if (!url) continue
    const meta = a.metadata && typeof a.metadata === 'object' ? a.metadata : {}
    if (meta.featured === true) featured.push(url)
    else urls.push(url)
  }
  return [...featured, ...urls].filter((u, i, arr) => arr.indexOf(u) === i)
}

export function dressingEdges (relationships: DressingRel[]): DressingEdge[] {
  const edges: DressingEdge[] = []
  for (const r of relationships) {
    if (r.relationshipType !== DRESSED_WITH_RELATIONSHIP) continue
    if (isInactiveBibleStatus(r.status)) continue
    if (r.fromType !== 'bible_entity' || r.toType !== 'bible_entity') continue
    const locationId = r.fromId.trim()
    const propId = r.toId.trim()
    if (!locationId || !propId) continue
    edges.push({
      relationshipId: r.id,
      locationId,
      propId,
      placement: (r.role || '').trim()
    })
  }
  return edges
}

function toLockedProp (
  entity: PropEntity,
  placement: string,
  assets?: ProjectAsset[],
  playbackUrl?: (asset: ProjectAsset) => string
): LockedProp {
  const plateUrls = assets?.length
    ? propPlateUrlsForEntity(entity.id, assets, playbackUrl).slice(0, 1)
    : []
  return {
    entityId: entity.id,
    name: entity.name.trim(),
    aliases: (entity.aliases || []).map((a) => a.trim()).filter(Boolean),
    look: (entity.summary || '').trim(),
    description: (entity.description || '').trim(),
    placement,
    plateUrls
  }
}

export function activePropEntities (entities: PropEntity[]): PropEntity[] {
  return entities.filter((e) => e.type === 'prop' && !isInactiveBibleStatus(e.status) && e.name.trim())
}

export function projectPropLocks (
  entities: PropEntity[],
  assets?: ProjectAsset[],
  playbackUrl?: (asset: ProjectAsset) => string
): LockedProp[] {
  return activePropEntities(entities)
    .map((e) => toLockedProp(e, '', assets, playbackUrl))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function dressingForLocation (
  locationId: string,
  entities: PropEntity[],
  relationships: DressingRel[],
  assets?: ProjectAsset[],
  playbackUrl?: (asset: ProjectAsset) => string
): LockedProp[] {
  const id = locationId.trim()
  if (!id) return []
  const byId = new Map(entities.map((e) => [e.id, e]))
  const out: LockedProp[] = []
  for (const edge of dressingEdges(relationships)) {
    if (edge.locationId !== id) continue
    const prop = byId.get(edge.propId)
    if (!prop || prop.type !== 'prop' || isInactiveBibleStatus(prop.status)) continue
    out.push(toLockedProp(prop, edge.placement, assets, playbackUrl))
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

function nameAppears (name: string, text: string): boolean {
  const n = name.trim()
  if (n.length < 2 || !text.trim()) return false
  return new RegExp(`\\b${escapeRegExp(n)}\\b`, 'i').test(text)
}

/** Props mentioned in the shot action, skipping ones already listed as set dressing. */
export function propsNamedInText (
  text: string,
  props: LockedProp[],
  excludeIds?: Iterable<string>
): LockedProp[] {
  const skip = new Set(excludeIds || [])
  const hits: LockedProp[] = []
  for (const prop of props) {
    if (!prop.entityId || skip.has(prop.entityId)) continue
    const names = [prop.name, ...(prop.aliases || [])]
    if (names.some((n) => nameAppears(n, text))) hits.push(prop)
  }
  return hits.slice(0, MAX_HERO_PROPS_IN_PROMPT)
}

function propLine (prop: LockedProp): string {
  const place = prop.placement ? ` — ${prop.placement}` : ''
  const look = (prop.description || prop.look || '').replace(/\s+/g, ' ').trim().slice(0, 220)
  return look ? `- ${prop.name}${place}. ${look}` : `- ${prop.name}${place}`
}

export function buildDressingPromptSection (dressing: LockedProp[] | null | undefined): string {
  const list = (dressing || []).filter((p) => p.name.trim()).slice(0, MAX_DRESSING_IN_PROMPT)
  if (!list.length) return ''
  return [
    'SET DRESSING (same objects in this place every shot — new camera; they may be held or moved):',
    ...list.map(propLine),
    PROP_LOCK_RULES
  ].join('\n')
}

export function buildHeroPropPromptSection (named: LockedProp[] | null | undefined): string {
  const list = (named || []).filter((p) => p.name.trim()).slice(0, MAX_HERO_PROPS_IN_PROMPT)
  if (!list.length) return ''
  return [
    'HERO PROPS IN THIS SHOT (same object even when it leaves the room):',
    ...list.map(propLine),
    PROP_LOCK_RULES
  ].join('\n')
}

export function ensurePropLocksInPrompt (
  prompt: string,
  opts: {
    dressing?: LockedProp[]
    named?: LockedProp[]
  }
): string {
  const inserts: string[] = []
  const dressing = buildDressingPromptSection(opts.dressing)
  const hero = buildHeroPropPromptSection(opts.named)
  if (dressing && !/SET DRESSING/i.test(prompt)) inserts.push(dressing)
  if (hero && !/HERO PROPS IN THIS SHOT/i.test(prompt)) inserts.push(hero)
  if (!inserts.length) return prompt.trim()
  const extra = inserts.join('\n\n')
  return `${extra}\n\n${prompt.trim()}`
}

/** Named objects first, then the room's dressing. One plate per object. */
export function selectPropPlateUrls (
  dressing: LockedProp[],
  named: LockedProp[],
  max = 2
): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const ordered = [
    ...named,
    ...dressing.filter((d) => !named.some((n) => n.entityId === d.entityId))
  ]
  for (const prop of ordered) {
    const url = (prop.plateUrls[0] || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
    if (urls.length >= max) break
  }
  return urls
}

export function buildPropPlateReferenceNote (count: number): string {
  if (count <= 0) return ''
  const which = count === 1 ? 'The attached prop plate locks that object' : `The attached ${count} prop plates lock those objects`
  return `${which}: same shape, materials, color, and condition. Do not copy the photo's angle. The object may be held or moved. Do not redesign it.`
}

export function hasLockedProps (dressing: LockedProp[] | undefined, named: LockedProp[] | undefined): boolean {
  return Boolean((dressing && dressing.length) || (named && named.length))
}
