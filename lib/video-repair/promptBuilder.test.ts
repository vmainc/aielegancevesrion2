import { describe, expect, it } from 'vitest'
import {
  ALEPH_PROMPT_MAX_CHARS,
  buildVideoRepairPrompt,
  versionLabelFromCategories
} from './promptBuilder'

describe('buildVideoRepairPrompt', () => {
  it('combines preservation, categories, character, and user description under Aleph limit', () => {
    const prompt = buildVideoRepairPrompt({
      categories: ['face_eyes', 'skin_tone'],
      userDescription:
        "The woman's eyes become too large halfway through the shot. Keep her facial proportions, skin tone, hair and clothing consistent with the beginning of the video.",
      repairMode: 'preserve',
      hasReferenceFrame: true,
      characterName: 'the woman',
      characterAppearance: 'mid-30s, dark brown hair, olive skin',
      sceneHeading: 'INT. KITCHEN - DAY',
      shotTitle: 'Close-up on Mara'
    })
    expect(prompt.length).toBeLessThanOrEqual(ALEPH_PROMPT_MAX_CHARS)
    expect(prompt).toMatch(/Keep original camera/i)
    expect(prompt).toMatch(/facial proportions and eye size/i)
    expect(prompt).toMatch(/skin tone/i)
    expect(prompt).toMatch(/the woman/i)
    expect(prompt).toMatch(/reference image/i)
    expect(prompt).toMatch(/Filmmaker instruction/i)
    expect(prompt).toMatch(/Smallest possible correction/i)
  })

  it('puts filmmaker intent first and strengthens reimagine', () => {
    const prompt = buildVideoRepairPrompt({
      categories: ['face_eyes'],
      userDescription: "Macklin's eyes must be dark brown and smaller.",
      repairMode: 'reimagine',
      hasReferenceFrame: true,
      characterName: 'Macklin',
      sourceGenerationModel: 'bytedance/seedance-2.0'
    })
    expect(prompt.length).toBeLessThanOrEqual(ALEPH_PROMPT_MAX_CHARS)
    expect(prompt.indexOf('Filmmaker instruction')).toBeLessThan(prompt.indexOf('Keep original camera'))
    expect(prompt).toMatch(/clearly visible change/i)
    expect(prompt).toMatch(/reference image as the target look/i)
    expect(prompt).toMatch(/Seedance 2\.0/)
    expect(prompt).toMatch(/lighting, color grade/)
  })

  it('ignores voice-only categories for visual instructions', () => {
    const prompt = buildVideoRepairPrompt({
      categories: ['voice'],
      userDescription: 'The voice changes.',
      repairMode: 'balanced',
      hasReferenceFrame: false
    })
    expect(prompt.length).toBeLessThanOrEqual(ALEPH_PROMPT_MAX_CHARS)
    expect(prompt).toMatch(/Keep original camera/i)
    expect(prompt).not.toMatch(/voice identity/i)
  })
})

describe('versionLabelFromCategories', () => {
  it('uses category labels', () => {
    expect(versionLabelFromCategories(['face_eyes'])).toBe('Face / Eyes')
    expect(versionLabelFromCategories(['character_consistency'])).toBe('Character Consistency')
    expect(versionLabelFromCategories(['face_eyes', 'hair'])).toContain('Face / Eyes')
  })
})
