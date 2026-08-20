import { describe, expect, it } from 'vitest'
import {
  buildSetLockPromptBlock,
  matchLocationEntity,
  resolveSetLock,
  SET_LOCK_NEGATIVES,
  SET_PLATE_SOURCE
} from './set-lock'
import type { BibleEntity } from '~/types/bible-entity'
import type { ProjectAsset } from '~/types/project-asset'

function loc (partial: Partial<BibleEntity> & { name: string }): BibleEntity {
  return {
    id: partial.id || 'e1',
    ownerId: 'u1',
    projectId: 'p1',
    type: 'location',
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

describe('set lock', () => {
  it('matches INT slug to a location entity', () => {
    const hit = matchLocationEntity('INT. RED BOOTH DINER - NIGHT', [
      loc({ name: 'Red Booth Diner', description: 'Chrome counter, cracked red vinyl booths, checkerboard tile.' })
    ])
    expect(hit?.name).toBe('Red Booth Diner')
  })

  it('builds a lock that keeps architecture but forbids copying camera', () => {
    const lock = resolveSetLock({
      sceneHeading: 'INT. RED BOOTH DINER - NIGHT',
      entities: [
        loc({
          name: 'Red Booth Diner',
          summary: '1950s diner, always the same room',
          description: 'Checkerboard floor, chrome stool line, neon OPEN in the window.'
        })
      ]
    })
    const block = buildSetLockPromptBlock(lock, 'INT. RED BOOTH DINER - NIGHT')
    expect(block).toContain('SET LOCK')
    expect(block).toContain('Checkerboard floor')
    expect(block).toMatch(/new camera/i)
    expect(block).toMatch(/Do NOT copy camera/i)
    expect(block).toMatch(/Photoreal/i)
    expect(SET_LOCK_NEGATIVES).toMatch(/soundstage/i)
  })

  it('prefers featured set plates', () => {
    const entity = loc({ id: 'loc1', name: 'Warehouse' })
    const assets: ProjectAsset[] = [
      {
        id: 'a1',
        projectId: 'p1',
        kind: 'other',
        title: 'Hero plate',
        notes: '',
        metadata: { source: SET_PLATE_SOURCE, bible_entity_id: 'loc1', featured: true },
        sortOrder: 0,
        fileUrl: 'https://example.com/hero.jpg',
        created: '',
        updated: ''
      }
    ]
    const lock = resolveSetLock({
      sceneHeading: 'INT. WAREHOUSE - DAY',
      entities: [entity],
      assets
    })
    expect(lock?.plateUrls).toEqual(['https://example.com/hero.jpg'])
  })
})
