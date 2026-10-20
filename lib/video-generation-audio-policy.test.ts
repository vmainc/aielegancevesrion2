import { describe, expect, it } from 'vitest'
import {
  appendSpokenDialogueSequence,
  resolveVideoGenerationUserPrompt
} from '~/lib/video-generation-audio-policy'

describe('sequential spoken dialogue', () => {
  it('formats multiple turns in order', () => {
    const out = appendSpokenDialogueSequence('Wide shot of the alley.', [
      { speakerName: 'JESUS', line: 'We leave now.', tone: 'urgent' },
      { speakerName: 'DRUG_DEALER', line: 'Not without the bag.', tone: 'tense' }
    ])
    expect(out).toContain('SEQUENTIAL EXCHANGE')
    expect(out).toContain('1. JESUS (urgent): "We leave now."')
    expect(out).toContain('2. DRUG_DEALER (tense): "Not without the bag."')
    expect(out).toContain('in sequence')
  })

  it('resolveVideoGenerationUserPrompt prefers dialogueTurns', () => {
    const out = resolveVideoGenerationUserPrompt({
      prompt: 'Two people face each other.',
      includeSpokenDialogue: true,
      dialogueLine: 'ignored single line',
      dialogueTurns: [
        { speakerName: 'A', line: 'Hello.' },
        { speakerName: 'B', line: 'Hi.' }
      ]
    })
    expect(out).toContain('1. A: "Hello."')
    expect(out).toContain('2. B: "Hi."')
    expect(out).not.toContain('ignored single line')
  })
})
