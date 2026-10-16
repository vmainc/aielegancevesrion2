import { describe, expect, it } from 'vitest'
import { buildCharacterPlateMap, characterPlateIdentityNote } from './character-plate-refs'
import type { ProjectAsset } from '~/types/project-asset'

function plate (partial: {
  id: string
  url: string
  label?: string
  featured?: boolean
  source?: string
}): ProjectAsset {
  return {
    id: partial.id,
    projectId: 'p1',
    kind: 'character',
    title: partial.id,
    notes: '',
    metadata: {
      character_id: 'char1',
      expression_label: partial.label || '',
      featured: partial.featured === true,
      source: partial.source || 'dossier'
    },
    sortOrder: 0,
    fileUrl: partial.url,
    created: '',
    updated: ''
  }
}

describe('character plate bundle', () => {
  it('sends the featured headshot first and drops the back before the face', () => {
    const map = buildCharacterPlateMap(
      [{ id: 'char1', name: 'VANDERMUTH' }],
      [
        plate({ id: 'front', url: 'https://example.com/front.jpg', label: 'Front' }),
        plate({ id: 'back', url: 'https://example.com/back.jpg', label: 'Back' }),
        plate({ id: 'left', url: 'https://example.com/left.jpg', label: 'Left' }),
        plate({ id: 'right', url: 'https://example.com/right.jpg', label: 'Right' }),
        plate({ id: 'head', url: 'https://example.com/head.jpg', label: 'Headshot', featured: true })
      ],
      (a) => a.fileUrl || ''
    )
    const bundle = map.get('char1')
    expect(bundle?.url).toBe('https://example.com/head.jpg')
    expect(bundle?.plateUrls).toEqual([
      'https://example.com/head.jpg',
      'https://example.com/front.jpg',
      'https://example.com/left.jpg',
      'https://example.com/right.jpg'
    ])
  })

  it('keeps Front as the face when no headshot is featured', () => {
    const map = buildCharacterPlateMap(
      [{ id: 'char1', name: 'VANDERMUTH' }],
      [
        plate({ id: 'front', url: 'https://example.com/front.jpg', label: 'Front' }),
        plate({ id: 'back', url: 'https://example.com/back.jpg', label: 'Back' })
      ],
      (a) => a.fileUrl || ''
    )
    expect(map.get('char1')?.url).toBe('https://example.com/front.jpg')
    expect(map.get('char1')?.plateUrls[0]).toBe('https://example.com/front.jpg')
  })

  it('does not send a voice clip as a plate', () => {
    const map = buildCharacterPlateMap(
      [{ id: 'char1', name: 'VANDERMUTH' }],
      [
        plate({ id: 'front', url: 'https://example.com/front.jpg', label: 'Front' }),
        {
          ...plate({ id: 'voice', url: 'https://example.com/voice.mp4' }),
          metadata: {
            character_id: 'char1',
            source: 'character_performance_clip',
            media_type: 'video'
          }
        }
      ],
      (a) => a.fileUrl || ''
    )
    expect(map.get('char1')?.plateUrls).toEqual(['https://example.com/front.jpg'])
  })
})

describe('character plate identity note', () => {
  it('tells the model the first plate is the face and the plates win', () => {
    const note = characterPlateIdentityNote(4)
    expect(note).toMatch(/first plate is the face/i)
    expect(note).toMatch(/plates win/i)
    expect(note).toMatch(/never change the face/i)
    expect(characterPlateIdentityNote(0)).toBe('')
  })
})
