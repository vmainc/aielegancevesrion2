import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  getSpeechToTextJob,
  newSpeechToTextJobId,
  registerSpeechToTextJob,
  releaseSpeechToTextSubmitLock,
  speechToTextDuplicateKey,
  tryAcquireSpeechToTextSubmitLock,
  updateSpeechToTextJob
} from '../server/utils/speech-to-text-store'

describe('speech-to-text job ownership and locks', () => {
  const userA = 'userAAAAAAAAAAA'
  const userB = 'userBBBBBBBBBBB'

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores jobs per id and preserves owning user', () => {
    const id = newSpeechToTextJobId()
    registerSpeechToTextJob(id, {
      status: 'transcribing',
      userId: userA,
      filename: 'a.mp3',
      mime: 'audio/mpeg',
      size: 1000,
      options: {
        style: 'cleaned',
        language: 'auto',
        speakerLabels: false,
        timestamps: false
      }
    })
    const job = getSpeechToTextJob(id)
    expect(job?.userId).toBe(userA)
    expect(job?.filename).toBe('a.mp3')
  })

  it('blocks duplicate submissions for the same user file while locked', () => {
    const key = speechToTextDuplicateKey(userA, 'same.mp3', 5000)
    expect(tryAcquireSpeechToTextSubmitLock(key)).toBe(true)
    expect(tryAcquireSpeechToTextSubmitLock(key)).toBe(false)
    releaseSpeechToTextSubmitLock(key)
    expect(tryAcquireSpeechToTextSubmitLock(key)).toBe(true)
    releaseSpeechToTextSubmitLock(key)
  })

  it('allows different users to submit the same filename/size', () => {
    const keyA = speechToTextDuplicateKey(userA, 'shared.mp3', 5000)
    const keyB = speechToTextDuplicateKey(userB, 'shared.mp3', 5000)
    expect(tryAcquireSpeechToTextSubmitLock(keyA)).toBe(true)
    expect(tryAcquireSpeechToTextSubmitLock(keyB)).toBe(true)
    releaseSpeechToTextSubmitLock(keyA)
    releaseSpeechToTextSubmitLock(keyB)
  })

  it('marks failed jobs without flipping usageCharged', () => {
    const id = newSpeechToTextJobId()
    registerSpeechToTextJob(id, {
      status: 'transcribing',
      userId: userA,
      filename: 'b.wav',
      mime: 'audio/wav',
      size: 2000,
      options: {
        style: 'verbatim',
        language: 'en',
        speakerLabels: false,
        timestamps: true
      },
      usageCharged: false
    })
    updateSpeechToTextJob(id, {
      status: 'failed',
      message: 'provider timeout',
      completedAt: Date.now()
    })
    const job = getSpeechToTextJob(id)
    expect(job?.status).toBe('failed')
    expect(job?.usageCharged).toBe(false)
    expect(job?.message).toMatch(/timeout/i)
  })
})
