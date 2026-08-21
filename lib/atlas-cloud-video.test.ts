import { describe, expect, it } from 'vitest'
import {
  ATLAS_SEEDANCE_25_I2V,
  ATLAS_SEEDANCE_25_PICKER_ID,
  ATLAS_SEEDANCE_25_T2V,
  atlasCloudHttpOk,
  atlasPredictionIsTerminalFailure,
  atlasPredictionIsTerminalSuccess,
  atlasSeedanceRatio,
  atlasSeedanceResolution,
  isAtlasCloudVideoModel,
  isSeedance25ModelId,
  parseAtlasCloudPrediction,
  resolveAtlasSeedanceModelId,
  snapAtlasSeedanceDuration
} from '~/lib/atlas-cloud-video'

describe('isAtlasCloudVideoModel', () => {
  it('matches picker id and native Atlas model ids', () => {
    expect(isAtlasCloudVideoModel(ATLAS_SEEDANCE_25_PICKER_ID)).toBe(true)
    expect(isAtlasCloudVideoModel(ATLAS_SEEDANCE_25_T2V)).toBe(true)
    expect(isAtlasCloudVideoModel(ATLAS_SEEDANCE_25_I2V)).toBe(true)
  })

  it('does not treat the OpenRouter Seedance 2.5 listing as Atlas', () => {
    expect(isAtlasCloudVideoModel('bytedance/seedance-2.5')).toBe(false)
    expect(isAtlasCloudVideoModel('bytedance/seedance-2.0')).toBe(false)
    expect(isAtlasCloudVideoModel('bytedance/seedance-2.0-fast')).toBe(false)
    expect(isAtlasCloudVideoModel('google/veo-3.1')).toBe(false)
  })

  it('recognizes Seedance 2.5 ids for Atlas routing when the key is present', () => {
    expect(isSeedance25ModelId(ATLAS_SEEDANCE_25_PICKER_ID)).toBe(true)
    expect(isSeedance25ModelId('bytedance/seedance-2.5')).toBe(true)
    expect(isSeedance25ModelId('bytedance/seedance-2.0')).toBe(false)
  })
})

describe('resolveAtlasSeedanceModelId', () => {
  it('uses image-to-video when a frame is present', () => {
    expect(
      resolveAtlasSeedanceModelId({
        requestedModel: ATLAS_SEEDANCE_25_PICKER_ID,
        hasFirstFrame: true,
        hasLastFrame: false
      })
    ).toBe(ATLAS_SEEDANCE_25_I2V)
  })

  it('uses text-to-video with no frames', () => {
    expect(
      resolveAtlasSeedanceModelId({
        requestedModel: ATLAS_SEEDANCE_25_PICKER_ID,
        hasFirstFrame: false,
        hasLastFrame: false
      })
    ).toBe(ATLAS_SEEDANCE_25_T2V)
  })

  it('keeps an explicit Atlas endpoint', () => {
    expect(
      resolveAtlasSeedanceModelId({
        requestedModel: ATLAS_SEEDANCE_25_T2V,
        hasFirstFrame: true,
        hasLastFrame: false
      })
    ).toBe(ATLAS_SEEDANCE_25_T2V)
  })
})

describe('snapAtlasSeedanceDuration', () => {
  it('clamps to 4–30 seconds', () => {
    expect(snapAtlasSeedanceDuration(1)).toBe(4)
    expect(snapAtlasSeedanceDuration(15)).toBe(15)
    expect(snapAtlasSeedanceDuration(30)).toBe(30)
    expect(snapAtlasSeedanceDuration(60)).toBe(30)
  })
})

describe('atlasSeedanceRatio / resolution', () => {
  it('forces adaptive for image-to-video', () => {
    expect(atlasSeedanceRatio({ atlasModelId: ATLAS_SEEDANCE_25_I2V, aspectRatio: '16:9' })).toBe(
      'adaptive'
    )
  })

  it('maps 9:21 to 9:16 for text-to-video', () => {
    expect(atlasSeedanceRatio({ atlasModelId: ATLAS_SEEDANCE_25_T2V, aspectRatio: '9:21' })).toBe(
      '9:16'
    )
  })

  it('maps 4K requests to native 1080p', () => {
    expect(atlasSeedanceResolution('4K')).toBe('1080p')
    expect(atlasSeedanceResolution('720p')).toBe('720p')
  })
})

describe('parseAtlasCloudPrediction', () => {
  it('reads submit envelopes', () => {
    const parsed = parseAtlasCloudPrediction({
      code: 200,
      data: { id: 'pred_1', status: 'processing' }
    })
    expect(parsed.id).toBe('pred_1')
    expect(parsed.status).toBe('processing')
    expect(atlasCloudHttpOk(parsed.code, 200)).toBe(true)
  })

  it('reads completed outputs', () => {
    const parsed = parseAtlasCloudPrediction({
      code: 200,
      data: {
        id: 'pred_2',
        status: 'completed',
        outputs: ['https://storage.atlascloud.ai/outputs/clip.mp4']
      }
    })
    expect(atlasPredictionIsTerminalSuccess(parsed.status)).toBe(true)
    expect(parsed.videoUrl).toBe('https://storage.atlascloud.ai/outputs/clip.mp4')
  })

  it('reads failed error strings', () => {
    const parsed = parseAtlasCloudPrediction({
      data: { id: 'pred_3', status: 'failed', error: 'content policy' }
    })
    expect(atlasPredictionIsTerminalFailure(parsed.status)).toBe(true)
    expect(parsed.message).toBe('content policy')
  })
})
