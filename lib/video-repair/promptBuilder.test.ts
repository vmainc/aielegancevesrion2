import { describe, expect, it } from 'vitest'
import { buildVideoRepairPrompt, versionLabelFromCategories } from './promptBuilder'

describe('buildVideoRepairPrompt', () => {
  it('combines preservation, categories, character, and user description', () => {
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
    expect(prompt).toMatch(/Preserve the original camera movement/i)
    expect(prompt).toMatch(/Do not redesign the shot/i)
    expect(prompt).toMatch(/facial proportions and eye size/i)
    expect(prompt).toMatch(/skin tone/i)
    expect(prompt).toMatch(/the woman/i)
    expect(prompt).toMatch(/supplied reference image/i)
    expect(prompt).toMatch(/INT\. KITCHEN/i)
    expect(prompt).toMatch(/Filmmaker instruction/i)
    expect(prompt).toMatch(/smallest possible visual correction/i)
  })

  it('ignores voice-only categories for visual instructions', () => {
    const prompt = buildVideoRepairPrompt({
      categories: ['voice'],
      userDescription: 'The voice changes.',
      repairMode: 'balanced',
      hasReferenceFrame: false
    })
    expect(prompt).toMatch(/Preserve the original camera movement/i)
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
