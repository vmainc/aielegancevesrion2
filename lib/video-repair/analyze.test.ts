import { describe, expect, it } from 'vitest'
import { ANALYSIS_TYPE_TO_CATEGORY } from './analyze'

describe('Analyze Shot → Fix Shot mapping', () => {
  it('maps findings to repair categories so FIX can prefill the form', () => {
    expect(ANALYSIS_TYPE_TO_CATEGORY.eye_facial_anomalies).toBe('face_eyes')
    expect(ANALYSIS_TYPE_TO_CATEGORY.character_identity_drift).toBe('character_consistency')
    expect(ANALYSIS_TYPE_TO_CATEGORY.audio_voice_consistency).toBe('voice')
  })
})
