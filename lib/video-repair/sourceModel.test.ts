import { describe, expect, it } from 'vitest'
import { GENERATION_OBSERVABILITY_METADATA_KEY } from '~/lib/generation-observability'
import {
  formatSourceGenerationModelLabel,
  readAssetSourceGenerationModel,
  sourceLookMatchPromptLine
} from './sourceModel'

describe('source generation model helpers', () => {
  it('reads model from generation_observability', () => {
    const model = readAssetSourceGenerationModel({
      [GENERATION_OBSERVABILITY_METADATA_KEY]: {
        generationPath: 'video_generation',
        model: 'bytedance/seedance-2.0',
        bibleContextUsed: false,
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    })
    expect(model).toBe('bytedance/seedance-2.0')
  })

  it('falls back to legacy model_id', () => {
    expect(readAssetSourceGenerationModel({ model_id: 'atlas/bytedance/seedance-2.5' })).toBe(
      'atlas/bytedance/seedance-2.5'
    )
  })

  it('formats Seedance labels and look-match line', () => {
    expect(formatSourceGenerationModelLabel('bytedance/seedance-2.0')).toBe('Seedance 2.0')
    expect(sourceLookMatchPromptLine('bytedance/seedance-2.0')).toMatch(/Seedance 2\.0/)
    expect(sourceLookMatchPromptLine('bytedance/seedance-2.0')).toMatch(/lighting, color grade/)
  })
})
