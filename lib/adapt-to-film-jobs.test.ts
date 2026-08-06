import { describe, expect, it } from 'vitest'
import {
  adaptSubmitLockKey,
  createJob,
  getJob,
  releaseAdaptSubmitLock,
  tryAcquireAdaptSubmitLock,
  updateJob
} from '../server/utils/adapt-to-film-job-registry'
import { createEmptyAdaptState, canEnterStage } from './adapt-to-film'

describe('adapt-to-film job registry', () => {
  it('creates and updates jobs', () => {
    const job = createJob({
      userId: 'user1',
      projectId: 'projabcdefghij1',
      kind: 'treatment',
      status: 'processing'
    })
    expect(job.jobId).toBeTruthy()
    expect(getJob(job.jobId)?.status).toBe('processing')
    updateJob(job.jobId, { status: 'completed', message: 'ok', usageCharged: false })
    expect(getJob(job.jobId)?.status).toBe('completed')
    expect(getJob(job.jobId)?.usageCharged).toBe(false)
  })

  it('prevents duplicate submit locks', () => {
    const key = adaptSubmitLockKey('u', 'p', 'scenes')
    releaseAdaptSubmitLock(key)
    expect(tryAcquireAdaptSubmitLock(key)).toBe(true)
    expect(tryAcquireAdaptSubmitLock(key)).toBe(false)
    releaseAdaptSubmitLock(key)
    expect(tryAcquireAdaptSubmitLock(key)).toBe(true)
    releaseAdaptSubmitLock(key)
  })
})

describe('adapt stage gates', () => {
  it('blocks later stages without source / treatment', () => {
    const empty = createEmptyAdaptState()
    expect(canEnterStage(empty, 'adaptation')).toMatch(/source/i)

    const withSource = createEmptyAdaptState({
      originalSourceText: 'A'.repeat(80),
      workingSourceText: 'A'.repeat(80)
    })
    expect(canEnterStage(withSource, 'adaptation')).toBeNull()
    expect(canEnterStage(withSource, 'scenes')).toMatch(/treatment/i)
  })

  it('seeds transcript metadata for Speech to Text → Film', () => {
    const state = createEmptyAdaptState({
      projectTitle: 'Interview Film',
      originalSourceText: 'B'.repeat(100),
      workingSourceText: 'B'.repeat(100),
      sourceMeta: {
        sourceTitle: 'interview.mp3',
        sourceType: 'transcript',
        originalAudioFilename: 'interview.mp3',
        speechToTextJobId: 'abc123'
      }
    })
    expect(state.sourceMeta.sourceType).toBe('transcript')
    expect(state.sourceMeta.originalAudioFilename).toBe('interview.mp3')
    expect(state.originalSourceText).toBe(state.workingSourceText)
  })
})
