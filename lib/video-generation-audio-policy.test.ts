import { describe, expect, it } from 'vitest'
import { resolveShotVideoGenerationPrompt } from './unified-shot-prompt'
import {
  appendSpokenDialogueSequence,
  resolveVideoGenerationUserPrompt
} from './video-generation-audio-policy'
import type { CreativeShot } from '~/types/creative-shot'

const voice = 'Low, clipped American general. Measured pace. Does not raise his voice.'

describe('voice lock on dialogue video prompts', () => {
  it('puts timbre ahead of the spoken line and keeps the quote exact', () => {
    const prompt = resolveVideoGenerationUserPrompt({
      prompt: 'Locked close-up. He looks to the right.',
      includeSpokenDialogue: true,
      dialogueLine: 'Amos, you know that\'s against protocol and established military procedure.',
      dialogueSpeakerName: 'Vandermuth',
      dialogueTone: 'tense',
      voiceLocks: [{ name: 'Vandermuth', voiceDescription: `"${voice}"` }]
    })

    const lockAt = prompt.indexOf('VOICE LOCK (timbre only')
    const spokenAt = prompt.indexOf('SPOKEN DIALOGUE')
    expect(lockAt).toBeGreaterThan(-1)
    expect(spokenAt).toBeGreaterThan(lockAt)
    expect(prompt).toContain(`Vandermuth: ${voice}`)
    expect(prompt).toContain(
      'Vandermuth says this line aloud: "Amos, you know that\'s against protocol and established military procedure."'
    )
    expect(prompt).not.toContain('in a tense tone')
    expect(prompt).toContain('Delivery only, never spoken aloud: tense')

    const quotes = [...prompt.matchAll(/"([^"]*)"/g)].map(m => m[1])
    expect(quotes).toEqual([
      'Amos, you know that\'s against protocol and established military procedure.'
    ])
  })

  it('does not add the voice lock twice', () => {
    const once = resolveVideoGenerationUserPrompt({
      prompt: 'Room.',
      includeSpokenDialogue: true,
      dialogueLine: 'Who fired first?',
      dialogueSpeakerName: 'Vandermuth',
      voiceLocks: [{ name: 'Vandermuth', voiceDescription: voice }]
    })
    const twice = resolveVideoGenerationUserPrompt({
      prompt: once,
      includeSpokenDialogue: true,
      dialogueLine: 'Who fired first?',
      dialogueSpeakerName: 'Vandermuth',
      voiceLocks: [{ name: 'Vandermuth', voiceDescription: voice }]
    })
    expect(twice.match(/VOICE LOCK \(timbre only/g)?.length).toBe(1)
  })
})

describe('shot video prompt carries the named character voice', () => {
  it('locks the character named in the shot and skips anyone else', () => {
    const shot = {
      id: 's',
      projectId: 'p',
      sceneId: 'sc',
      sortOrder: 1,
      title: 'Vandermuth speaks',
      description: 'Vandermuth looks right and speaks.',
      shotType: 'close-up',
      cameraMove: 'locked',
      durationSeconds: 8,
      imagePrompt: 'Close-up of Vandermuth.',
      videoPrompt: 'He stays seated.',
      negativePrompt: ''
    } satisfies CreativeShot

    const prompt = resolveShotVideoGenerationPrompt(shot, {
      cast: [
        { name: 'Vandermuth', traitsRoleVisual: 'Four-star general', voiceDescription: voice },
        { name: 'Worthing', traitsRoleVisual: 'Two-star general', voiceDescription: 'Older, careful, uneasy.' }
      ]
    })

    expect(prompt).toContain(`Vandermuth: ${voice}`)
    expect(prompt).not.toContain('Worthing:')
  })
})

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
