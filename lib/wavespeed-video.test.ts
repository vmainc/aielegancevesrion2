import { describe, expect, it } from 'vitest'
import {
  enrichSeedance25ResolutionsForHd,
  parseWaveSpeedPrediction,
  shouldRouteSeedance25ViaWaveSpeed,
  snapWaveSpeedSeedanceDuration,
  waveSpeedPredictionIsTerminalFailure,
  waveSpeedPredictionIsTerminalSuccess,
  waveSpeedSeedanceAspectRatio,
  waveSpeedSeedanceResolution
} from '~/lib/wavespeed-video'

describe('shouldRouteSeedance25ViaWaveSpeed', () => {
  it('routes Seedance 2.5 1080p through WaveSpeed when keyed', () => {
    expect(
      shouldRouteSeedance25ViaWaveSpeed({
        modelId: 'bytedance/seedance-2.5',
        resolution: '1080p',
        waveSpeedKeyConfigured: true
      })
    ).toBe(true)
  })

  it('keeps 720p on OpenRouter', () => {
    expect(
      shouldRouteSeedance25ViaWaveSpeed({
        modelId: 'bytedance/seedance-2.5',
        resolution: '720p',
        waveSpeedKeyConfigured: true
      })
    ).toBe(false)
  })

  it('does not route without a key', () => {
    expect(
      shouldRouteSeedance25ViaWaveSpeed({
        modelId: 'bytedance/seedance-2.5',
        resolution: '1080p',
        waveSpeedKeyConfigured: false
      })
    ).toBe(false)
  })
})

describe('enrichSeedance25ResolutionsForHd', () => {
  it('adds 1080p when an HD provider is configured', () => {
    expect(
      enrichSeedance25ResolutionsForHd('bytedance/seedance-2.5', ['480p', '720p'], true)
    ).toEqual(['480p', '720p', '1080p'])
  })
})

describe('waveSpeedSeedance helpers', () => {
  it('clamps duration and resolution', () => {
    expect(snapWaveSpeedSeedanceDuration(30)).toBe(30)
    expect(snapWaveSpeedSeedanceDuration(60)).toBe(30)
    expect(waveSpeedSeedanceResolution('1080p')).toBe('1080p')
    expect(waveSpeedSeedanceResolution('4K')).toBe('1080p')
    expect(waveSpeedSeedanceAspectRatio('9:21')).toBe('9:16')
  })
})

describe('parseWaveSpeedPrediction', () => {
  it('reads submit and completed envelopes', () => {
    const submitted = parseWaveSpeedPrediction({
      code: 200,
      data: { id: 'pred_ws', status: 'created' }
    })
    expect(submitted.id).toBe('pred_ws')
    expect(submitted.status).toBe('created')

    const done = parseWaveSpeedPrediction({
      data: {
        id: 'pred_ws',
        status: 'completed',
        outputs: ['https://cdn.example.com/out.mp4']
      }
    })
    expect(waveSpeedPredictionIsTerminalSuccess(done.status)).toBe(true)
    expect(done.videoUrl).toBe('https://cdn.example.com/out.mp4')
    expect(waveSpeedPredictionIsTerminalFailure('failed')).toBe(true)
  })
})
