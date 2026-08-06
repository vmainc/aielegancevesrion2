import type PocketBase from 'pocketbase'
import { castNameAppearsInText } from '~/lib/cast-name-convention'
import {
  bibleEntityDedupeKey,
  bibleRelationshipDedupeKey,
  BIBLE_SEED_CHARACTER_SOURCE,
  normalizeBibleEntityNameKey,
  normalizeBibleFactStatementKey
} from '~/lib/bible-seed-normalize'
import { extractLocationFromSceneHeading } from '~/lib/bible-scene-location'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'
import { pbRecordToCreativeCharacter, projectIdOnCharacterRow } from '~/server/utils/creative-character-map'
import { parseDirectorField, pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { pbRecordToCreativeScene } from '~/server/utils/creative-scene-map'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'
import { pbRecordToBibleEntity, projectIdOnBibleEntityRow } from '~/server/utils/bible-entity-map'
import { pbRecordToBibleFact, projectIdOnBibleFactRow } from '~/server/utils/bible-fact-map'
import {
  pbRecordToBibleRelationship,
  projectIdOnBibleRelationshipRow
} from '~/server/utils/bible-relationship-map'
import { BIBLE_ENTITY_TYPES, type BibleEntityType } from '~/types/bible-entity'
import type { CreativeCharacter, ProjectDirector } from '~/types/creative-project'

export const BIBLE_DIRECTOR_SOURCE = 'project_director'
export const BIBLE_CONCEPT_SOURCE = 'project_concept'
export const BIBLE_PROJECT_MIRROR_SOURCE = 'project_mirror'
export const BIBLE_PROJECT_SYNC_ACTOR_ID = 'project_bible_sync'

const ENTITY_STATUS = 'active' as const
const FACT_STATUS = 'active' as const
const REL_STATUS = 'active' as const

export const PROJECT_BIBLE_SCOPES = [
  'concept',
  'characters',
  'director',
  'scenes',
  'shots',
  'assets'
] as const

export type ProjectBibleScope = (typeof PROJECT_BIBLE_SCOPES)[number]

export type ProjectBibleSyncResult = {
  scopes: ProjectBibleScope[]
  charactersSynced: number
  directorSynced: boolean
  conceptSynced: boolean
  locationsSynced: number
  entitiesCreated: number
  entitiesUpdated: number
  entitiesRetired: number
  factsCreated: number
  factsUpdated: number
  relationshipsCreated: number
  relationshipsUpdated: number
  skipped: boolean
  skipReason?: string
}

const CHARACTER_FACT_FIELDS: Array<{
  key: keyof CreativeCharacter
  factType: string
  prefix: string
  fieldId: string
}> = [
  { key: 'appearanceDescription', factType: 'appearance', prefix: 'Appearance', fieldId: 'appearance' },
  { key: 'roleDescription', factType: 'provenance', prefix: 'Role', fieldId: 'role' },
  { key: 'personality', factType: 'rule', prefix: 'Personality', fieldId: 'personality' },
  { key: 'voiceDescription', factType: 'style', prefix: 'Voice', fieldId: 'voice' },
  { key: 'signatureDetails', factType: 'wardrobe', prefix: 'Signature details', fieldId: 'signature' },
  { key: 'avoidDescription', factType: 'negative_constraint', prefix: 'Avoid', fieldId: 'avoid' }
]

const DIRECTOR_FACT_FIELDS: Array<{
  key: keyof ProjectDirector
  factType: string
  prefix: string
  fieldId: string
}> = [
  { key: 'style', factType: 'style', prefix: 'Style', fieldId: 'style' },
  { key: 'tone', factType: 'style', prefix: 'Tone', fieldId: 'tone' },
  { key: 'camera_preferences', factType: 'style', prefix: 'Camera', fieldId: 'camera' },
  { key: 'lighting_style', factType: 'style', prefix: 'Lighting', fieldId: 'lighting' },
  { key: 'pacing', factType: 'style', prefix: 'Pacing', fieldId: 'pacing' }
]

function resolveScopes (scopes?: ProjectBibleScope | ProjectBibleScope[] | 'all'): ProjectBibleScope[] {
  if (!scopes || scopes === 'all') return [...PROJECT_BIBLE_SCOPES]
  if (typeof scopes === 'string') return [scopes]
  const set = new Set(scopes)
  return PROJECT_BIBLE_SCOPES.filter((s) => set.has(s))
}

function assetMeta (raw: Record<string, unknown>): Record<string, unknown> {
  const m = raw.metadata
  if (m && typeof m === 'object' && !Array.isArray(m)) return m as Record<string, unknown>
  return {}
}

function structuredMetadataEntity (
  meta: Record<string, unknown>
): { type: BibleEntityType; name: string } | null {
  const t = typeof meta.bible_entity_type === 'string' ? meta.bible_entity_type.trim() : ''
  const n =
    typeof meta.bible_entity_name === 'string'
      ? meta.bible_entity_name.trim()
      : typeof meta.entity_name === 'string'
        ? meta.entity_name.trim()
        : ''
  if (!t || !n) return null
  if (!BIBLE_ENTITY_TYPES.includes(t as BibleEntityType)) return null
  if (t === 'character' || t === 'location') return null
  return { type: t as BibleEntityType, name: n }
}

function buildCharacterDescription (c: CreativeCharacter): string {
  return [c.roleDescription, c.appearanceDescription, c.personality, c.signatureDetails]
    .filter((p) => typeof p === 'string' && p.trim())
    .join('\n\n')
    .slice(0, 50_000)
}

function buildCharacterSummary (c: CreativeCharacter): string {
  return (c.roleDescription.trim() || c.appearanceDescription?.trim() || '').slice(0, 5000)
}

function directorEntityName (d: ProjectDirector): string {
  return d.name.trim() || 'Director bible'
}

function buildDirectorDescription (d: ProjectDirector, continuityMemory: string): string {
  return [
    d.style && `Style: ${d.style}`,
    d.tone && `Tone: ${d.tone}`,
    d.camera_preferences && `Camera: ${d.camera_preferences}`,
    d.lighting_style && `Lighting: ${d.lighting_style}`,
    d.pacing && `Pacing: ${d.pacing}`,
    continuityMemory.trim() && `Continuity:\n${continuityMemory.trim()}`
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 50_000)
}

function directorHasContent (d: ProjectDirector, continuityMemory: string): boolean {
  return Boolean(
    d.name.trim() ||
      d.style.trim() ||
      d.tone.trim() ||
      d.camera_preferences.trim() ||
      d.lighting_style.trim() ||
      d.pacing.trim() ||
      continuityMemory.trim()
  )
}

async function loadCollection (
  pb: PocketBase,
  collection: string,
  filter: string,
  projectIdOnRow?: (row: Record<string, unknown>) => string
): Promise<Record<string, unknown>[]> {
  try {
    return (await pb.collection(collection).getFullList({
      filter,
      batch: 5000
    })) as Record<string, unknown>[]
  } catch {
    if (!projectIdOnRow) return []
    try {
      const all = (await pb.collection(collection).getFullList({ batch: 5000 })) as Record<
        string,
        unknown
      >[]
      const projectId = filter.match(/project="([^"]+)"/)?.[1] || ''
      return all.filter((r) => projectIdOnRow(r) === projectId)
    } catch {
      return []
    }
  }
}

/**
 * Upsert the Production Bible from current project state so creative edits stay mirrored.
 * Project tables remain source of truth; bible rows are derived and kept active.
 */
export async function syncProjectToBible (opts: {
  pb: PocketBase
  userId: string
  projectId: string
  scopes?: ProjectBibleScope | ProjectBibleScope[] | 'all'
  /** When set, only sync these character ids (still requires characters scope). */
  characterIds?: string[]
  /** Retire bible character entities whose creative_character ids were deleted. */
  retireCharacterIds?: string[]
}): Promise<ProjectBibleSyncResult> {
  const { pb, userId, projectId } = opts
  const scopes = resolveScopes(opts.scopes)
  const result: ProjectBibleSyncResult = {
    scopes,
    charactersSynced: 0,
    directorSynced: false,
    conceptSynced: false,
    locationsSynced: 0,
    entitiesCreated: 0,
    entitiesUpdated: 0,
    entitiesRetired: 0,
    factsCreated: 0,
    factsUpdated: 0,
    relationshipsCreated: 0,
    relationshipsUpdated: 0,
    skipped: false
  }

  const needCharacters = scopes.includes('characters') || scopes.includes('scenes')
  const needScenes = scopes.includes('scenes') || scopes.includes('shots') || scopes.includes('assets')
  const needShots = scopes.includes('shots') || scopes.includes('assets')
  const needAssets = scopes.includes('assets')
  const needProject = scopes.includes('concept') || scopes.includes('director')

  const [characterRows, sceneRows, shotRows, assetRows, entityRows, factRows, relRows, projectRaw] =
    await Promise.all([
      needCharacters
        ? loadCollection(pb, 'creative_characters', `project="${projectId}"`, projectIdOnCharacterRow)
        : Promise.resolve([] as Record<string, unknown>[]),
      needScenes
        ? loadCollection(pb, 'creative_scenes', `project="${projectId}"`)
        : Promise.resolve([] as Record<string, unknown>[]),
      needShots
        ? loadCollection(pb, 'creative_shots', `project="${projectId}"`)
        : Promise.resolve([] as Record<string, unknown>[]),
      needAssets
        ? loadCollection(pb, 'project_assets', `project="${projectId}"`)
        : Promise.resolve([] as Record<string, unknown>[]),
      loadCollection(pb, 'bible_entities', `project="${projectId}"`, projectIdOnBibleEntityRow),
      loadCollection(pb, 'bible_facts', `project="${projectId}"`, projectIdOnBibleFactRow),
      loadCollection(pb, 'bible_relationships', `project="${projectId}"`, projectIdOnBibleRelationshipRow),
      needProject
        ? pb.collection('creative_projects').getOne(projectId).catch(() => null)
        : Promise.resolve(null)
    ])

  const allCharacters = characterRows.map((r) => pbRecordToCreativeCharacter(r))
  const characters = opts.characterIds?.length
    ? allCharacters.filter((c) => opts.characterIds!.includes(c.id))
    : allCharacters
  const scenes = sceneRows.map((r) =>
    pbRecordToCreativeScene(r as Parameters<typeof pbRecordToCreativeScene>[0])
  )
  const shots = shotRows.map((r) =>
    pbRecordToCreativeShot(r as Parameters<typeof pbRecordToCreativeShot>[0])
  )
  const entities = entityRows.map((r) =>
    pbRecordToBibleEntity(r as Parameters<typeof pbRecordToBibleEntity>[0])
  )
  const facts = factRows.map((r) =>
    pbRecordToBibleFact(r as Parameters<typeof pbRecordToBibleFact>[0])
  )
  const relationships = relRows.map((r) =>
    pbRecordToBibleRelationship(r as Parameters<typeof pbRecordToBibleRelationship>[0])
  )

  const entityByKey = new Map<string, string>()
  const characterIdToEntityId = new Map<string, string>()
  let directorEntityId: string | null = null
  let conceptEntityId: string | null = null

  for (const e of entities) {
    entityByKey.set(bibleEntityDedupeKey(e.type, e.name), e.id)
    if (e.sourceType === BIBLE_SEED_CHARACTER_SOURCE && e.sourceId) {
      characterIdToEntityId.set(e.sourceId, e.id)
    }
    if (e.sourceType === BIBLE_DIRECTOR_SOURCE && e.sourceId === projectId) {
      directorEntityId = e.id
    }
    if (e.sourceType === BIBLE_CONCEPT_SOURCE && e.sourceId === projectId) {
      conceptEntityId = e.id
    }
  }

  for (const c of allCharacters) {
    const byName = entityByKey.get(bibleEntityDedupeKey('character', c.name))
    if (byName && !characterIdToEntityId.has(c.id)) characterIdToEntityId.set(c.id, byName)
  }

  /** Field-keyed facts: entityId + source_id */
  const factByField = new Map<string, { id: string; statement: string; status: string }>()
  /** Statement-keyed facts (legacy seed rows) */
  const factByStatement = new Map<string, { id: string; status: string }>()
  for (const f of facts) {
    if (!f.entityId) continue
    factByStatement.set(`${f.entityId}:${normalizeBibleFactStatementKey(f.statement)}`, {
      id: f.id,
      status: f.status
    })
    if (f.sourceId) {
      factByField.set(`${f.entityId}:${f.sourceId}`, {
        id: f.id,
        statement: f.statement,
        status: f.status
      })
    }
  }

  const relKeys = new Map<string, { id: string; status: string }>()
  for (const r of relationships) {
    const key = bibleRelationshipDedupeKey({
      fromType: r.fromType,
      fromId: r.fromId,
      toType: r.toType,
      toId: r.toId,
      relationshipType: r.relationshipType
    })
    relKeys.set(key, { id: r.id, status: r.status })
  }

  const markMissing = () => {
    result.skipped = true
    result.skipReason = 'bible collections missing'
  }

  async function upsertEntity (input: {
    type: BibleEntityType
    name: string
    summary: string
    description: string
    sourceType: string
    sourceId: string
    existingId?: string | null
  }): Promise<string | null> {
    const key = bibleEntityDedupeKey(input.type, input.name)
    const existingId = input.existingId || entityByKey.get(key) || null
    const payload = {
      name: input.name.trim().slice(0, 500),
      summary: input.summary.slice(0, 5000),
      description: input.description.slice(0, 50_000),
      status: ENTITY_STATUS,
      source_type: input.sourceType,
      source_id: input.sourceId,
      actor_type: 'system',
      actor_id: BIBLE_PROJECT_SYNC_ACTOR_ID
    }

    if (existingId) {
      try {
        await pb.collection('bible_entities').update(existingId, payload)
        result.entitiesUpdated++
        entityByKey.set(key, existingId)
        return existingId
      } catch (e: unknown) {
        if (isPocketBaseMissingCollectionError(e)) {
          markMissing()
          return null
        }
        throw e
      }
    }

    try {
      const created = await pb.collection('bible_entities').create({
        owned_by: userId,
        project: projectId,
        entity_type: input.type,
        ...payload
      })
      const id = String((created as { id?: string }).id || '')
      if (!id) return null
      result.entitiesCreated++
      entityByKey.set(key, id)
      return id
    } catch (e: unknown) {
      if (isPocketBaseMissingCollectionError(e)) {
        markMissing()
        return null
      }
      throw e
    }
  }

  async function upsertFieldFact (input: {
    entityId: string
    fieldId: string
    statement: string
    factType: string
  }) {
    const stmt = input.statement.trim().slice(0, 10_000)
    const fieldKey = `${input.entityId}:${input.fieldId}`
    const existingField = factByField.get(fieldKey)

    if (!stmt) {
      if (existingField && existingField.status !== 'retired') {
        try {
          await pb.collection('bible_facts').update(existingField.id, {
            status: 'retired',
            actor_type: 'system',
            actor_id: BIBLE_PROJECT_SYNC_ACTOR_ID
          })
          result.factsUpdated++
          factByField.set(fieldKey, { ...existingField, status: 'retired' })
        } catch (e: unknown) {
          if (isPocketBaseMissingCollectionError(e)) markMissing()
        }
      }
      return
    }

    if (existingField) {
      const needsUpdate =
        existingField.statement.trim() !== stmt || existingField.status !== FACT_STATUS
      if (needsUpdate) {
        try {
          await pb.collection('bible_facts').update(existingField.id, {
            statement: stmt,
            fact_type: input.factType,
            status: FACT_STATUS,
            source_type: BIBLE_PROJECT_MIRROR_SOURCE,
            source_id: input.fieldId,
            actor_type: 'system',
            actor_id: BIBLE_PROJECT_SYNC_ACTOR_ID
          })
          result.factsUpdated++
          factByField.set(fieldKey, { id: existingField.id, statement: stmt, status: FACT_STATUS })
          factByStatement.set(`${input.entityId}:${normalizeBibleFactStatementKey(stmt)}`, {
            id: existingField.id,
            status: FACT_STATUS
          })
        } catch (e: unknown) {
          if (isPocketBaseMissingCollectionError(e)) markMissing()
        }
      }
      return
    }

    const stmtKey = `${input.entityId}:${normalizeBibleFactStatementKey(stmt)}`
    const legacy = factByStatement.get(stmtKey)
    if (legacy) {
      try {
        await pb.collection('bible_facts').update(legacy.id, {
          status: FACT_STATUS,
          source_type: BIBLE_PROJECT_MIRROR_SOURCE,
          source_id: input.fieldId,
          actor_type: 'system',
          actor_id: BIBLE_PROJECT_SYNC_ACTOR_ID
        })
        result.factsUpdated++
        factByField.set(fieldKey, { id: legacy.id, statement: stmt, status: FACT_STATUS })
      } catch (e: unknown) {
        if (isPocketBaseMissingCollectionError(e)) markMissing()
      }
      return
    }

    try {
      const created = await pb.collection('bible_facts').create({
        owned_by: userId,
        project: projectId,
        entity: input.entityId,
        fact_type: input.factType,
        statement: stmt,
        status: FACT_STATUS,
        source_type: BIBLE_PROJECT_MIRROR_SOURCE,
        source_id: input.fieldId,
        actor_type: 'system',
        actor_id: BIBLE_PROJECT_SYNC_ACTOR_ID
      })
      const id = String((created as { id?: string }).id || '')
      if (!id) return
      result.factsCreated++
      factByField.set(fieldKey, { id, statement: stmt, status: FACT_STATUS })
      factByStatement.set(stmtKey, { id, status: FACT_STATUS })
    } catch (e: unknown) {
      if (isPocketBaseMissingCollectionError(e)) markMissing()
    }
  }

  async function ensureRelationship (input: {
    fromType: string
    fromId: string
    toType: string
    toId: string
    relationshipType: string
  }) {
    const rKey = bibleRelationshipDedupeKey(input)
    const existing = relKeys.get(rKey)
    if (existing) {
      if (existing.status !== REL_STATUS) {
        try {
          await pb.collection('bible_relationships').update(existing.id, {
            status: REL_STATUS,
            actor_type: 'system',
            actor_id: BIBLE_PROJECT_SYNC_ACTOR_ID
          })
          result.relationshipsUpdated++
          relKeys.set(rKey, { id: existing.id, status: REL_STATUS })
        } catch (e: unknown) {
          if (isPocketBaseMissingCollectionError(e)) markMissing()
        }
      }
      return
    }
    try {
      const created = await pb.collection('bible_relationships').create({
        owned_by: userId,
        project: projectId,
        from_type: input.fromType,
        from_id: input.fromId,
        to_type: input.toType,
        to_id: input.toId,
        relationship_type: input.relationshipType,
        status: REL_STATUS,
        source_type: BIBLE_PROJECT_MIRROR_SOURCE,
        actor_type: 'system',
        actor_id: BIBLE_PROJECT_SYNC_ACTOR_ID
      })
      const id = String((created as { id?: string }).id || '')
      if (id) {
        relKeys.set(rKey, { id, status: REL_STATUS })
        result.relationshipsCreated++
      }
    } catch (e: unknown) {
      if (isPocketBaseMissingCollectionError(e)) markMissing()
    }
  }

  // --- Retire deleted characters ---
  if (opts.retireCharacterIds?.length) {
    for (const cid of opts.retireCharacterIds) {
      const eid = characterIdToEntityId.get(cid)
      if (!eid) continue
      try {
        await pb.collection('bible_entities').update(eid, {
          status: 'retired',
          actor_type: 'system',
          actor_id: BIBLE_PROJECT_SYNC_ACTOR_ID
        })
        result.entitiesRetired++
      } catch (e: unknown) {
        if (isPocketBaseMissingCollectionError(e)) {
          markMissing()
          return result
        }
      }
    }
  }

  // --- Characters ---
  if (scopes.includes('characters')) {
    for (const c of characters) {
      if (!c.name.trim()) continue
      const existingId =
        characterIdToEntityId.get(c.id) ||
        entityByKey.get(bibleEntityDedupeKey('character', c.name)) ||
        null
      const entityId = await upsertEntity({
        type: 'character',
        name: c.name,
        summary: buildCharacterSummary(c),
        description: buildCharacterDescription(c),
        sourceType: BIBLE_SEED_CHARACTER_SOURCE,
        sourceId: c.id,
        existingId
      })
      if (!entityId) {
        if (result.skipped) return result
        continue
      }
      characterIdToEntityId.set(c.id, entityId)
      for (const spec of CHARACTER_FACT_FIELDS) {
        const value = c[spec.key]
        await upsertFieldFact({
          entityId,
          fieldId: `char_field:${spec.fieldId}`,
          statement:
            typeof value === 'string' && value.trim() ? `${spec.prefix}: ${value.trim()}` : '',
          factType: spec.factType
        })
        if (result.skipped) return result
      }
      result.charactersSynced++
    }
  }

  // --- Concept (synopsis / genre / tone / treatment / themes) ---
  if (scopes.includes('concept') && projectRaw) {
    const project = pbRecordToCreativeProject(
      projectRaw as Parameters<typeof pbRecordToCreativeProject>[0]
    )
    const name = (project.name.trim() || 'Project').slice(0, 500)
    const summary = [project.genre, project.tone].filter((s) => s?.trim()).join(' · ').slice(0, 5000)
    const description = [
      project.synopsis && `Synopsis:\n${project.synopsis}`,
      project.treatment && `Treatment:\n${project.treatment.slice(0, 20_000)}`
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 50_000)

    const entityId = await upsertEntity({
      type: 'concept',
      name,
      summary: summary || name,
      description,
      sourceType: BIBLE_CONCEPT_SOURCE,
      sourceId: projectId,
      existingId: conceptEntityId
    })
    if (entityId) {
      conceptEntityId = entityId
      const conceptFacts: Array<{ fieldId: string; statement: string; factType: string }> = [
        {
          fieldId: 'field:genre',
          statement: project.genre?.trim() ? `Genre: ${project.genre.trim()}` : '',
          factType: 'rule'
        },
        {
          fieldId: 'field:tone',
          statement: project.tone?.trim() ? `Tone: ${project.tone.trim()}` : '',
          factType: 'style'
        },
        {
          fieldId: 'field:synopsis',
          statement: project.synopsis.trim() ? `Synopsis: ${project.synopsis.trim().slice(0, 9000)}` : '',
          factType: 'provenance'
        },
        {
          fieldId: 'field:treatment',
          statement: project.treatment.trim()
            ? `Treatment: ${project.treatment.trim().slice(0, 9000)}`
            : '',
          factType: 'provenance'
        },
        {
          fieldId: 'field:themes',
          statement: project.themes?.length ? `Themes: ${project.themes.join(', ')}` : '',
          factType: 'rule'
        }
      ]
      for (const f of conceptFacts) {
        await upsertFieldFact({
          entityId,
          fieldId: f.fieldId,
          statement: f.statement,
          factType: f.factType
        })
        if (result.skipped) return result
      }
      result.conceptSynced = true
    }
  }

  // --- Director ---
  if (scopes.includes('director') && projectRaw) {
    const director =
      parseDirectorField((projectRaw as { director?: unknown }).director) || {
        name: '',
        style: '',
        tone: '',
        camera_preferences: '',
        lighting_style: '',
        pacing: ''
      }
    const continuityMemory = String(
      (projectRaw as { continuity_memory?: string }).continuity_memory || ''
    )
    if (directorHasContent(director, continuityMemory)) {
      const name = directorEntityName(director)
      const summary = [director.style, director.tone].filter((s) => s.trim()).join(' · ').slice(0, 5000)
      const entityId = await upsertEntity({
        type: 'style_rule',
        name,
        summary: summary || name,
        description: buildDirectorDescription(director, continuityMemory),
        sourceType: BIBLE_DIRECTOR_SOURCE,
        sourceId: projectId,
        existingId: directorEntityId
      })
      if (entityId) {
        directorEntityId = entityId
        for (const spec of DIRECTOR_FACT_FIELDS) {
          const value = director[spec.key]
          await upsertFieldFact({
            entityId,
            fieldId: `dir_field:${spec.fieldId}`,
            statement:
              typeof value === 'string' && value.trim() ? `${spec.prefix}: ${value.trim()}` : '',
            factType: spec.factType
          })
          if (result.skipped) return result
        }
        await upsertFieldFact({
          entityId,
          fieldId: 'dir_field:continuity',
          statement: continuityMemory.trim() ? `Continuity: ${continuityMemory.trim()}` : '',
          factType: 'continuity'
        })
        result.directorSynced = true
      }
    }
  }

  // --- Scenes → locations + appears_in ---
  if (scopes.includes('scenes')) {
    const locationNames = new Set<string>()
    for (const scene of scenes) {
      const loc = extractLocationFromSceneHeading(scene.heading)
      if (!loc) continue
      const norm = normalizeBibleEntityNameKey(loc)
      if (locationNames.has(norm)) {
        const locId = entityByKey.get(bibleEntityDedupeKey('location', loc))
        if (locId) {
          await ensureRelationship({
            fromType: 'scene',
            fromId: scene.id,
            toType: 'bible_entity',
            toId: locId,
            relationshipType: 'located_in'
          })
        }
        continue
      }
      locationNames.add(norm)
      const locId = await upsertEntity({
        type: 'location',
        name: loc,
        summary: scene.summary.slice(0, 5000),
        description: `Derived from scene heading: ${scene.heading}`.slice(0, 50_000),
        sourceType: BIBLE_PROJECT_MIRROR_SOURCE,
        sourceId: `location:${norm}`,
        existingId: entityByKey.get(bibleEntityDedupeKey('location', loc))
      })
      if (!locId) {
        if (result.skipped) return result
        continue
      }
      result.locationsSynced++
      await ensureRelationship({
        fromType: 'scene',
        fromId: scene.id,
        toType: 'bible_entity',
        toId: locId,
        relationshipType: 'located_in'
      })
    }

    for (const scene of scenes) {
      const sceneText = [scene.heading, scene.summary, scene.body].filter(Boolean).join('\n')
      if (!sceneText.trim()) continue
      for (const c of allCharacters) {
        if (!c.name.trim()) continue
        if (!castNameAppearsInText(c.name, sceneText)) continue
        const eid = characterIdToEntityId.get(c.id)
        if (!eid) continue
        await ensureRelationship({
          fromType: 'bible_entity',
          fromId: eid,
          toType: 'scene',
          toId: scene.id,
          relationshipType: 'appears_in'
        })
        if (result.skipped) return result
      }
    }
  }

  // --- Shots → belongs_to scene ---
  if (scopes.includes('shots')) {
    for (const shot of shots) {
      if (!shot.id || !shot.sceneId) continue
      await ensureRelationship({
        fromType: 'shot',
        fromId: shot.id,
        toType: 'scene',
        toId: shot.sceneId,
        relationshipType: 'belongs_to'
      })
      if (result.skipped) return result
    }
  }

  // --- Assets → depicts + structured entities ---
  if (scopes.includes('assets')) {
    for (const row of assetRows) {
      const structured = structuredMetadataEntity(assetMeta(row))
      if (structured) {
        await upsertEntity({
          type: structured.type,
          name: structured.name,
          summary: typeof row.title === 'string' ? row.title : '',
          description: '',
          sourceType: BIBLE_PROJECT_MIRROR_SOURCE,
          sourceId: `asset_entity:${String(row.id || '')}`,
          existingId: entityByKey.get(bibleEntityDedupeKey(structured.type, structured.name))
        })
        if (result.skipped) return result
      }
    }

    for (const row of assetRows) {
      const assetId = String(row.id || '')
      if (!assetId) continue
      const meta = assetMeta(row)
      const characterId = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
      const sceneId = typeof meta.scene_id === 'string' ? meta.scene_id.trim() : ''
      const shotId = typeof meta.shot_id === 'string' ? meta.shot_id.trim() : ''

      if (characterId) {
        const entityId = characterIdToEntityId.get(characterId)
        if (entityId) {
          await ensureRelationship({
            fromType: 'asset',
            fromId: assetId,
            toType: 'bible_entity',
            toId: entityId,
            relationshipType: 'depicts'
          })
        }
      }
      if (sceneId && scenes.some((s) => s.id === sceneId)) {
        await ensureRelationship({
          fromType: 'asset',
          fromId: assetId,
          toType: 'scene',
          toId: sceneId,
          relationshipType: 'depicts'
        })
      }
      if (shotId && shots.some((s) => s.id === shotId)) {
        await ensureRelationship({
          fromType: 'asset',
          fromId: assetId,
          toType: 'shot',
          toId: shotId,
          relationshipType: 'depicts'
        })
      }
      if (result.skipped) return result
    }
  }

  return result
}

export async function syncProjectToBibleSafe (
  opts: Parameters<typeof syncProjectToBible>[0]
): Promise<ProjectBibleSyncResult | null> {
  try {
    return await syncProjectToBible(opts)
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) return null
    console.warn('[syncProjectToBible]', e)
    return null
  }
}
