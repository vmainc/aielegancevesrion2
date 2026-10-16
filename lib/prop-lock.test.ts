import { describe, expect, it } from 'vitest'
import {
  buildHeroPropPromptSection,
  ensurePropLocksInPrompt,
  propsNamedInText,
  selectPropPlateUrls,
  type LockedProp
} from './prop-lock'
import { buildSetLockPromptBlock, resolveSetLock } from './set-lock'
import { buildUnifiedProductionPrompt } from './unified-shot-prompt'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleRelationship } from '~/types/bible-relationship'
import type { ProjectAsset } from '~/types/project-asset'

function entity (partial: Partial<BibleEntity> & { name: string; type: BibleEntity['type'] }): BibleEntity {
  return {
    id: partial.id || partial.name,
    ownerId: 'u1',
    projectId: 'p1',
    type: partial.type,
    name: partial.name,
    slug: '',
    aliases: partial.aliases || [],
    summary: partial.summary || '',
    description: partial.description || '',
    status: partial.status || 'active',
    confidence: null,
    sourceType: '',
    sourceId: '',
    actorType: '',
    actorId: '',
    created: '',
    updated: ''
  }
}

function dressed (locationId: string, propId: string, placement: string): BibleRelationship {
  return {
    id: `rel-${locationId}-${propId}`,
    ownerId: 'u1',
    projectId: 'p1',
    fromType: 'bible_entity',
    fromId: locationId,
    toType: 'bible_entity',
    toId: propId,
    relationshipType: 'dressed_with',
    role: placement,
    strength: null,
    status: 'active',
    sourceType: '',
    sourceId: '',
    actorType: '',
    actorId: '',
    created: '',
    updated: ''
  }
}

function prop (partial: Partial<LockedProp> & { name: string }): LockedProp {
  return {
    entityId: partial.entityId || partial.name,
    name: partial.name,
    aliases: partial.aliases || [],
    look: partial.look || '',
    description: partial.description || '',
    placement: partial.placement || '',
    plateUrls: partial.plateUrls || []
  }
}

describe('prop lock', () => {
  const location = entity({
    id: 'loc1',
    type: 'location',
    name: 'Newsroom',
    description: 'Glass walls, concrete floor, long window on the west side.'
  })
  const tv = entity({
    id: 'tv1',
    type: 'prop',
    name: 'Wall TV',
    summary: '65-inch matte black screen',
    description: 'Thin bezel, no logo, low oak stand.'
  })
  const laptop = entity({
    id: 'lap1',
    type: 'prop',
    name: 'Field laptop',
    aliases: ['laptop'],
    description: 'Silver clamshell with a dent on the lid.'
  })

  it('puts location dressing on the set lock and leaves traveling props in the catalog', () => {
    const lock = resolveSetLock({
      sceneHeading: 'INT. NEWSROOM - DAY',
      entities: [location, tv, laptop],
      relationships: [dressed('loc1', 'tv1', 'north wall')]
    })
    expect(lock?.dressing.map((p) => p.name)).toEqual(['Wall TV'])
    expect(lock?.dressing[0]?.placement).toBe('north wall')
    expect(lock?.props.map((p) => p.name).sort()).toEqual(['Field laptop', 'Wall TV'])
    const block = buildSetLockPromptBlock(lock, 'INT. NEWSROOM - DAY')
    expect(block).toContain('SET DRESSING')
    expect(block).toContain('Wall TV — north wall')
    expect(block).toContain('Thin bezel')
    expect(block).not.toContain('Field laptop')
  })

  it('names a traveling prop from the shot without repeating set dressing', () => {
    const lock = resolveSetLock({
      sceneHeading: 'INT. NEWSROOM - DAY',
      entities: [location, tv, laptop],
      relationships: [dressed('loc1', 'tv1', 'north wall')]
    })
    const prompt = buildUnifiedProductionPrompt(
      {
        title: 'Opens the laptop',
        description: 'She sets the laptop on the desk. The Wall TV stays on.',
        shotType: 'medium',
        cameraMove: 'static',
        imagePrompt: '',
        negativePrompt: ''
      },
      { cast: [], setLock: lock }
    )
    expect(prompt).toContain('SET DRESSING')
    expect(prompt).toContain('HERO PROPS IN THIS SHOT')
    expect(prompt).toContain('Field laptop')
    expect(prompt).toContain('redesigned hero prop')
    const hero = (prompt.slice(prompt.indexOf('HERO PROPS IN THIS SHOT')).split('\n\n')[0] || '')
    expect(hero).toContain('Field laptop')
    expect(hero).not.toContain('Wall TV')
  })

  it('does not add a second dressing block when the prompt already has one', () => {
    const dressing = [prop({ name: 'Wall TV', placement: 'north wall', description: 'Thin bezel.' })]
    const once = ensurePropLocksInPrompt('SET DRESSING\n- Wall TV', { dressing })
    expect(once.match(/SET DRESSING/g)).toHaveLength(1)
  })

  it('matches aliases and skips dressing ids', () => {
    const locks = [
      prop({ entityId: 'tv1', name: 'Wall TV' }),
      prop({ entityId: 'lap1', name: 'Field laptop', aliases: ['laptop'] })
    ]
    const named = propsNamedInText('She opens the laptop.', locks, ['tv1'])
    expect(named.map((p) => p.entityId)).toEqual(['lap1'])
  })

  it('prefers a named prop plate over room dressing', () => {
    const urls = selectPropPlateUrls(
      [prop({ entityId: 'tv', name: 'Wall TV', plateUrls: ['https://example.com/tv.jpg'] })],
      [prop({ entityId: 'lap', name: 'Field laptop', plateUrls: ['https://example.com/laptop.jpg'] })],
      1
    )
    expect(urls).toEqual(['https://example.com/laptop.jpg'])
  })

  it('attaches featured prop plates on the lock', () => {
    const assets: ProjectAsset[] = [
      {
        id: 'a1',
        projectId: 'p1',
        kind: 'other',
        title: 'TV plate',
        notes: '',
        metadata: { source: 'prop_plate', bible_entity_id: 'tv1', featured: true },
        sortOrder: 0,
        fileUrl: 'https://example.com/tv.jpg',
        created: '',
        updated: ''
      }
    ]
    const lock = resolveSetLock({
      sceneHeading: 'INT. NEWSROOM - DAY',
      entities: [location, tv],
      relationships: [dressed('loc1', 'tv1', 'north wall')],
      assets
    })
    expect(lock?.dressing[0]?.plateUrls).toEqual(['https://example.com/tv.jpg'])
  })

  it('builds a hero section for an object that travels', () => {
    const block = buildHeroPropPromptSection([
      prop({ name: 'Field laptop', description: 'Silver clamshell with a dent on the lid.' })
    ])
    expect(block).toMatch(/leaves the room/i)
    expect(block).toContain('dent on the lid')
  })
})
