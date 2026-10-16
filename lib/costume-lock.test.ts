import { describe, expect, it } from 'vitest'
import {
  activeCostumeId,
  buildCostumeLockPromptBlock,
  DEFAULT_COSTUME_ID,
  ensureCostumeLockInPrompt,
  normalizeCostumes,
  resolveCostumeForScene,
  selectCostumePlateUrls
} from './costume-lock'

describe('costume lock', () => {
  const costumes = normalizeCostumes([
    { id: 'ignored', name: 'Everyday', description: 'Navy wool coat, grey trousers, scuffed brown boots.' },
    {
      id: 'gala',
      name: 'Gala',
      description: 'Black tuxedo, white shirt, no tie.',
      sceneIds: ['scene-gala', 'scene-gala']
    },
    {
      id: 'rain',
      name: 'Soaked',
      description: 'Same coat, soaked through, collar up.',
      sceneIds: ['scene-gala', 'scene-rain']
    }
  ])

  it('keeps three looks and gives the gala scene to the first change', () => {
    expect(costumes).toHaveLength(3)
    expect(costumes[0]?.id).toBe(DEFAULT_COSTUME_ID)
    expect(costumes[1]?.sceneIds).toEqual(['scene-gala'])
    expect(costumes[2]?.sceneIds).toEqual(['scene-rain'])
  })

  it('wears the everyday outfit unless the scene assigns a change', () => {
    expect(resolveCostumeForScene(costumes, 'scene-office')?.name).toBe('Everyday')
    expect(resolveCostumeForScene(costumes, 'scene-rain')?.name).toBe('Soaked')
    expect(activeCostumeId(costumes, 'scene-rain')).toBe('rain')
    expect(activeCostumeId([], 'scene-office')).toBe(DEFAULT_COSTUME_ID)
  })

  it('locks the clothes and leaves the face alone', () => {
    const block = buildCostumeLockPromptBlock([
      {
        characterName: 'Mara',
        lookName: 'Everyday',
        description: 'Navy wool coat, grey trousers, scuffed brown boots.'
      }
    ])
    expect(block).toContain('COSTUME LOCK')
    expect(block).toContain('MARA wears "Everyday"')
    expect(block).toMatch(/does not replace the face/i)
    const twice = ensureCostumeLockInPrompt(`${block}\n\nSTILL`, block)
    expect(twice.match(/COSTUME LOCK/g)).toHaveLength(1)
    const swapped = ensureCostumeLockInPrompt(twice, buildCostumeLockPromptBlock([
      { characterName: 'Mara', lookName: 'Gala', description: 'Black tuxedo, white shirt, no tie.' }
    ]))
    expect(swapped).toContain('wears "Gala"')
    expect(swapped).not.toContain('Navy wool coat')
    expect(swapped.match(/COSTUME LOCK/g)).toHaveLength(1)
  })

  it('picks the plate for the look this scene is wearing', () => {
    const urls = selectCostumePlateUrls([
      {
        costumes,
        costumePlates: {
          [DEFAULT_COSTUME_ID]: 'https://example.com/everyday.jpg',
          rain: 'https://example.com/soaked.jpg'
        }
      }
    ], 'scene-rain', 1)
    expect(urls).toEqual(['https://example.com/soaked.jpg'])
  })

  it('drops a blank everyday outfit when nothing else is locked', () => {
    expect(normalizeCostumes([{ name: 'Everyday', description: '' }])).toEqual([])
  })
})
