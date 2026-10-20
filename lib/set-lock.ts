import {
  extractLocationFromSceneHeading,
  sceneHeadingLocationParts
} from '~/lib/bible-scene-location'
import { normalizeBibleEntityNameKey } from '~/lib/bible-seed-normalize'
import { BIBLE_ASSET_ENTITY_METADATA_KEY, readAssetBridgeFields } from '~/lib/bible-cast-asset-bridge'
import {
  buildDressingPromptSection,
  dressingForLocation,
  projectPropLocks,
  type LockedProp
} from '~/lib/prop-lock'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleRelationship } from '~/types/bible-relationship'
import type { ProjectAsset } from '~/types/project-asset'

export const SET_PLATE_SOURCE = 'set_plate'

/** Photoreal practical-location language — identity of the place, not a copied still. */
export const SET_LOCK_PHOTOREAL_RULES = [
  'Same real location every panel: identical architecture, materials, color, spatial layout, and signature landmarks.',
  'Do NOT copy camera, lens, blocking, or composition from the establishing plate or a prior frame.',
  'New coverage each panel — as if the crew walked the same practical set and chose a different setup.',
  'Photoreal lived-in space: real wear, imperfect surfaces, physical light, believable scale. Not CGI, LED volume, soundstage flats, miniature, or dollhouse.'
].join(' ')

export const SET_LOCK_NEGATIVES =
  'CGI set, Unreal Engine, virtual production volume, LED wall, green screen, soundstage cyc, fake walls, toy miniature, dollhouse, obviously digital architecture, repeating the same establishing composition, identical camera every panel'

export interface SetLock {
  name: string
  entityId?: string
  architecture: string
  summary: string
  plateUrls: string[]
  /** Objects that live in this location. */
  dressing: LockedProp[]
  /** Every active prop in the project, for shots that name a traveling object. */
  props: LockedProp[]
}

export function isSetPlateAsset (asset: ProjectAsset): boolean {
  const meta = asset.metadata && typeof asset.metadata === 'object' ? asset.metadata : {}
  const source = typeof meta.source === 'string' ? meta.source.trim() : ''
  return source === SET_PLATE_SOURCE || source === 'location_upload'
}

export function setPlateUrlsForEntity (
  entityId: string,
  assets: ProjectAsset[],
  playbackUrl?: (asset: ProjectAsset) => string
): string[] {
  const id = entityId.trim()
  if (!id) return []
  const urls: string[] = []
  const featured: string[] = []
  for (const a of assets) {
    const fields = readAssetBridgeFields(a.metadata)
    if (fields.bibleEntityId !== id) continue
    const meta = a.metadata && typeof a.metadata === 'object' ? a.metadata : {}
    const source = typeof meta.source === 'string' ? meta.source.trim() : ''
    if (source && source !== SET_PLATE_SOURCE && source !== 'location_upload') continue
    const url = (playbackUrl ? playbackUrl(a) : a.fileUrl || '').trim()
    if (!url) continue
    if (meta.featured === true) featured.push(url)
    else urls.push(url)
  }
  return [...featured, ...urls].filter((u, i, arr) => arr.indexOf(u) === i)
}

function entityNameKeys (
  entity: Pick<BibleEntity, 'name' | 'aliases'>
): string[] {
  return [entity.name, ...(entity.aliases || [])]
    .map((n) => normalizeBibleEntityNameKey(n))
    .filter(Boolean)
}

/**
 * Match a slug to a bible location. A sub-place wins over its parent when both
 * exist: INT. PENTAGON - WAR ROOM locks War Room, not the exterior Pentagon.
 */
export function matchLocationEntity (
  sceneHeading: string,
  entities: Array<Pick<BibleEntity, 'id' | 'type' | 'name' | 'summary' | 'description' | 'status' | 'aliases'>>
): (typeof entities)[number] | null {
  const locations = entities.filter((e) => e.type === 'location' && e.status !== 'retired')
  if (!locations.length) return null

  const parts = sceneHeadingLocationParts(sceneHeading)
  const needles = (parts.length ? [...parts].reverse() : [sceneHeading])
    .map((p) => normalizeBibleEntityNameKey(p))
    .filter(Boolean)
  if (!needles.length) return null

  for (const needle of needles) {
    const exact = locations.find((e) => entityNameKeys(e).some((k) => k === needle))
    if (exact) return exact
  }
  for (const needle of needles) {
    const fuzzy = locations.find((e) =>
      entityNameKeys(e).some((k) => k.length >= 4 && (needle.includes(k) || k.includes(needle)))
    )
    if (fuzzy) return fuzzy
  }
  return null
}

export function resolveSetLock (opts: {
  sceneHeading?: string
  entities?: Array<Pick<BibleEntity, 'id' | 'type' | 'name' | 'summary' | 'description' | 'status' | 'aliases'>>
  relationships?: Array<Pick<BibleRelationship, 'id' | 'fromType' | 'fromId' | 'toType' | 'toId' | 'relationshipType' | 'role' | 'status'>>
  assets?: ProjectAsset[]
  playbackUrl?: (asset: ProjectAsset) => string
}): SetLock | null {
  const heading = (opts.sceneHeading || '').trim()
  const locName = extractLocationFromSceneHeading(heading)
  const entities = opts.entities || []
  const entity = entities.length
    ? matchLocationEntity(heading, entities)
    : null
  const architecture = (entity?.description || '').trim()
  const summary = (entity?.summary || '').trim()
  const plateUrls = entity?.id && opts.assets?.length
    ? setPlateUrlsForEntity(entity.id, opts.assets, opts.playbackUrl)
    : []
  const props = projectPropLocks(entities, opts.assets, opts.playbackUrl)
  const dressing = entity?.id
    ? dressingForLocation(entity.id, entities, opts.relationships || [], opts.assets, opts.playbackUrl)
    : []
  const name = (entity?.name || locName || '').trim()
  if (!name && !architecture && !plateUrls.length && !dressing.length && !props.length) return null
  return {
    name: name || 'Location',
    entityId: entity?.id,
    architecture,
    summary,
    plateUrls,
    dressing,
    props
  }
}

export function buildSetLockPromptBlock (
  lock: SetLock | null | undefined,
  sceneHeading?: string
): string {
  const heading = (sceneHeading || '').trim()
  const locFromSlug = extractLocationFromSceneHeading(heading)
  if (!lock && !locFromSlug && !heading) return ''

  const name = (lock?.name || locFromSlug || 'this location').trim()
  const lines = [
    'SET LOCK (same real place — new camera every panel):',
    `Location: ${name}`,
    heading && heading !== name ? `Slug: ${heading}` : '',
    lock?.summary ? `Look: ${lock.summary.slice(0, 400)}` : '',
    lock?.architecture ? `Architecture / materials / layout:\n${lock.architecture.slice(0, 1200)}` : '',
    lock?.plateUrls.length
      ? 'An establishing set plate is attached as a vision reference — match the PLACE, not the plate’s camera.'
      : '',
    SET_LOCK_PHOTOREAL_RULES,
    buildDressingPromptSection(lock?.dressing)
  ].filter(Boolean)
  return lines.join('\n')
}

export function buildSetLockReferenceNote (hasSetPlate: boolean, hasContinuityFrame: boolean): string {
  const parts: string[] = []
  if (hasSetPlate) {
    parts.push(
      'SET PLATE: match architecture, materials, color, and spatial layout of the attached location still. Do not copy its camera, lens, blocking, or crop. Photograph a new setup in the same practical location. Photoreal, lived-in, real scale.'
    )
  }
  if (hasContinuityFrame) {
    parts.push(
      'CONTINUITY FRAME: keep the same place and cast designs as the attached prior still. Change composition, lens, and blocking for this panel — do not clone the previous camera.'
    )
  }
  return parts.join(' ')
}

export function setLockMetadata (entityId: string, featured = true): Record<string, unknown> {
  return {
    source: SET_PLATE_SOURCE,
    [BIBLE_ASSET_ENTITY_METADATA_KEY]: entityId,
    featured,
    set_lock: true
  }
}
