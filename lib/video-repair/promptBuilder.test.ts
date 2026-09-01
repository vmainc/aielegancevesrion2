import { describe, expect, it } from 'vitest'
import {
  ALEPH_PROMPT_MAX_CHARS,
  buildVideoRepairPrompt,
  versionLabelFromCategories
} from './promptBuilder'
import { resolveEffectiveRepairMode } from './types'

describe('resolveEffectiveRepairMode', () => {
  it('bumps face/eye categories to reimagine', () => {
    expect(resolveEffectiveRepairMode('balanced', ['face_eyes'], 'fix the look')).toBe('reimagine')
    expect(resolveEffectiveRepairMode('preserve', ['character_consistency'], 'keep identity')).toBe(
      'reimagine'
    )
  })

  it('bumps when description mentions eyes even without the category', () => {
    expect(
      resolveEffectiveRepairMode('balanced', ['other'], "Macklin's eyes must be dark brown")
    ).toBe('reimagine')
  })

  it('leaves non-face repairs on the requested mode', () => {
    expect(resolveEffectiveRepairMode('balanced', ['background'], 'fix the wall glitch')).toBe(
      'balanced'
    )
    expect(resolveEffectiveRepairMode('preserve', ['clothing'], 'keep the jacket')).toBe('preserve')
  })
})

describe('buildVideoRepairPrompt', () => {
  it('combines preservation, categories, character, and user description under Aleph limit', () => {
    const prompt = buildVideoRepairPrompt({
      categories: ['face_eyes', 'skin_tone'],
      userDescription:
        "The woman's eyes become too large halfway through the shot. Keep her facial proportions, skin tone, hair and clothing consistent with the beginning of the video.",
      repairMode: 'preserve',
      hasReferenceFrame: false,
      characterName: 'the woman',
      characterAppearance: 'mid-30s, dark brown hair, olive skin',
      sceneHeading: 'INT. KITCHEN - DAY',
      shotTitle: 'Close-up on Mara'
    })
    expect(prompt.length).toBeLessThanOrEqual(ALEPH_PROMPT_MAX_CHARS)
    expect(prompt).toMatch(/Edit the source video in place/i)
    expect(prompt).toMatch(/iris\/eye color|iris color/i)
    expect(prompt).toMatch(/skin tone/i)
    expect(prompt).toMatch(/the woman/i)
    expect(prompt).toMatch(/Bible look \(text only\):.*dark brown hair/i)
    expect(prompt).toMatch(/Filmmaker instruction/i)
    expect(prompt).toMatch(/obvious in every frame|Strong visible correction/i)
  })

  it('puts filmmaker intent first and strengthens reimagine with bible text only', () => {
    const prompt = buildVideoRepairPrompt({
      categories: ['face_eyes'],
      userDescription: "Macklin's eyes must be dark brown and smaller.",
      repairMode: 'reimagine',
      hasReferenceFrame: false,
      characterName: 'Macklin',
      characterAppearance: 'Macklin, late 30s, deep dark brown eyes, short curly black hair, trimmed beard',
      characterNotes: 'Front lookbook plate — dark brown irises',
      sourceGenerationModel: 'bytedance/seedance-2.0'
    })
    expect(prompt.length).toBeLessThanOrEqual(ALEPH_PROMPT_MAX_CHARS)
    expect(prompt.indexOf('Filmmaker instruction')).toBe(0)
    expect(prompt).toMatch(/Edit the source video in place/i)
    expect(prompt).toMatch(/character sheet|studio backdrop/i)
    expect(prompt).toMatch(/obvious in every frame|clearly visible change/i)
    expect(prompt).toMatch(/Bible look \(text only\):.*dark brown eyes/i)
    expect(prompt).toMatch(/Bible notes \(text only\)/i)
    expect(prompt).toMatch(/Seedance 2\.0/)
    expect(prompt).toMatch(/Exception: eye color/i)
  })

  it('warns against restyling when a face-crop keyframe is present', () => {
    const prompt = buildVideoRepairPrompt({
      categories: ['face_eyes'],
      userDescription: 'Darken the irises.',
      repairMode: 'reimagine',
      hasReferenceFrame: true,
      characterName: 'Macklin'
    })
    expect(prompt).toMatch(/iris color\/size only|face reference/i)
    expect(prompt).toMatch(/studio character sheet/i)
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
