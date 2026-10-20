import { describe, expect, it } from 'vitest'
import { findCharactersInShot, type ProjectCharacterRef } from './shot-character-continuity'

function ref (id: string, name: string): ProjectCharacterRef {
  return { id, name, roleDescription: '', portraitUrl: null }
}

const cast = [
  ref('a', 'Vandermuth'),
  ref('b', 'Bromhead'),
  ref('c', 'Alien Raptor'),
  ref('d', 'Mara'),
  ref('e', 'Quinn'),
  ref('f', 'Soren'),
  ref('g', 'Ilya')
]

describe('findCharactersInShot', () => {
  it('uses the panel cast line instead of everyone named nearby', () => {
    const hits = findCharactersInShot(
      {
        title: 'Wide',
        description: 'Dust blows across the site. Vandermuth is not in this angle.',
        imagePrompt: 'Cast in this panel: BROMHEAD.',
        videoPrompt: '',
        shotType: 'wide'
      },
      cast
    )
    expect(hits.map(c => c.name)).toEqual(['Bromhead'])
  })

  it('selects only names in the shot beat', () => {
    const hits = findCharactersInShot(
      {
        title: 'Greeting',
        description: 'Vandermuth turns as Bromhead enters.',
        imagePrompt: '',
        videoPrompt: '',
        shotType: 'medium'
      },
      cast
    )
    expect(hits.map(c => c.name)).toEqual(['Vandermuth', 'Bromhead'])
  })

  it('does not fill the shot with the project cast when nobody is named', () => {
    const hits = findCharactersInShot(
      {
        title: 'Empty street',
        description: 'Wind moves a loose tarp. No one is visible.',
        imagePrompt: '',
        videoPrompt: '',
        shotType: 'wide'
      },
      cast
    )
    expect(hits).toEqual([])
  })

  it('does not treat a scene-wide cast list in the image bible as this shot', () => {
    const hits = findCharactersInShot(
      {
        title: 'Door',
        description: 'A hand pushes the door.',
        imagePrompt: [
          'A hand pushes the door.',
          'FULL CAST BIBLE',
          'Vandermuth, Bromhead, Alien Raptor, Mara, Quinn, Soren, Ilya'
        ].join('\n'),
        videoPrompt: '',
        shotType: 'insert'
      },
      cast
    )
    expect(hits).toEqual([])
  })
})
