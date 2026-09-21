import { describe, expect, it } from 'vitest'
import { buildImageFinalPrompt, hasActiveFilmControls } from '~/lib/image-generation-prompt'
import {
  buildOpenRouterImageRequest,
  normalizeImageModel,
  pickDefaultAspectRatio,
  pickDefaultImageModelId
} from '~/lib/normalize-image-model'
import { decodeOpenRouterImageResponse } from '~/server/utils/openrouter-generate-images-api'

describe('buildImageFinalPrompt', () => {
  it('keeps user prompt when no film controls', () => {
    const r = buildImageFinalPrompt('  a rainy motel  ')
    expect(r.prompt).toBe('a rainy motel')
    expect(r.finalPrompt).toBe('a rainy motel')
  })

  it('appends filmmaking direction without replacing user prompt', () => {
    const r = buildImageFinalPrompt('abandoned motel at night', {
      shotSize: 'Wide',
      cameraAngle: 'Low Angle',
      lens: '35mm',
      lighting: 'Neon',
      style: 'Cinematic'
    })
    expect(r.prompt).toBe('abandoned motel at night')
    expect(r.finalPrompt).toContain('abandoned motel at night')
    expect(r.finalPrompt).toContain('Shot size: Wide.')
    expect(r.finalPrompt).toContain('Camera angle: Low Angle.')
    expect(r.finalPrompt).toContain('Lens: 35mm.')
    expect(r.finalPrompt).toContain('Lighting: Neon.')
    expect(r.finalPrompt).toContain('Visual style: Cinematic.')
  })

  it('hasActiveFilmControls detects selections', () => {
    expect(hasActiveFilmControls(null)).toBe(false)
    expect(hasActiveFilmControls({ shotSize: 'Wide' })).toBe(true)
  })
})

describe('normalizeImageModel', () => {
  it('normalizes capabilities from OpenRouter metadata', () => {
    const model = normalizeImageModel({
      id: 'bytedance-seed/seedream-4.5',
      name: 'Seedream 4.5',
      description: 'A text-to-image model.',
      architecture: {
        input_modalities: ['text', 'image'],
        output_modalities: ['image']
      },
      supported_parameters: {
        resolution: { type: 'enum', values: ['1K', '2K', '4K'] },
        aspect_ratio: { type: 'enum', values: ['1:1', '16:9', '9:16'] },
        n: { type: 'integer', min: 1, max: 4 },
        input_references: { type: 'unknown' }
      },
      pricing: { image: 0.01 }
    })
    expect(model).not.toBeNull()
    expect(model!.id).toBe('bytedance-seed/seedream-4.5')
    expect(model!.provider).toBe('Bytedance Seed')
    expect(model!.aspectRatios).toEqual(['1:1', '16:9', '9:16'])
    expect(model!.resolutions).toEqual(['1K', '2K', '4K'])
    expect(model!.maxImages).toBe(4)
    expect(model!.supportsReferences).toBe(true)
    expect(model!.supportsEditing).toBe(true)
    expect(model!.badges).toContain('REFERENCE IMAGE')
    expect(model!.badges).toContain('LOW COST')
  })

  it('does not invent reference support', () => {
    const model = normalizeImageModel({
      id: 'black-forest-labs/flux.2-pro',
      name: 'FLUX.2 Pro',
      architecture: { input_modalities: ['text'], output_modalities: ['image'] },
      supported_parameters: {
        aspect_ratio: { type: 'enum', values: ['1:1', '16:9'] }
      }
    })
    expect(model!.supportsReferences).toBe(false)
    expect(model!.maxImages).toBe(1)
    expect(model!.badges).not.toContain('REFERENCE IMAGE')
  })
})

describe('buildOpenRouterImageRequest', () => {
  const baseModel = normalizeImageModel({
    id: 'test/model',
    name: 'Test',
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
    supported_parameters: {
      aspect_ratio: { type: 'enum', values: ['1:1', '16:9'] },
      resolution: { type: 'enum', values: ['1K', '2K'] },
      n: { type: 'integer', min: 1, max: 2 },
      input_references: { type: 'unknown' },
      seed: { type: 'integer' }
    }
  })!

  it('includes only supported parameters', () => {
    const body = buildOpenRouterImageRequest({
      model: baseModel,
      prompt: 'hello',
      aspectRatio: '16:9',
      resolution: '2K',
      n: 2,
      inputReferences: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }],
      advanced: { seed: 42, guidance: 7, negativePrompt: 'blurry' }
    })
    expect(body).toEqual({
      model: 'test/model',
      prompt: 'hello',
      aspect_ratio: '16:9',
      resolution: '2K',
      n: 2,
      input_references: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }],
      seed: 42
    })
    expect(body.guidance).toBeUndefined()
    expect(body.negative_prompt).toBeUndefined()
  })

  it('omits unsupported aspect ratio and n when not allowed', () => {
    const limited = normalizeImageModel({
      id: 'test/limited',
      name: 'Limited',
      architecture: { input_modalities: ['text'], output_modalities: ['image'] },
      supported_parameters: {
        aspect_ratio: { type: 'enum', values: ['1:1'] }
      }
    })!
    const body = buildOpenRouterImageRequest({
      model: limited,
      prompt: 'x',
      aspectRatio: '16:9',
      n: 4,
      inputReferences: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }]
    })
    expect(body.aspect_ratio).toBeUndefined()
    expect(body.n).toBeUndefined()
    expect(body.input_references).toBeUndefined()
  })
})

describe('pickDefaultImageModelId / pickDefaultAspectRatio', () => {
  it('falls back when preferred missing', () => {
    const id = pickDefaultImageModelId(
      [{ id: 'black-forest-labs/flux.2-klein-4b' }, { id: 'other/x' }],
      'missing/model'
    )
    expect(id).toBe('black-forest-labs/flux.2-klein-4b')
  })

  it('prefers 16:9 when supported', () => {
    expect(pickDefaultAspectRatio(['1:1', '16:9', '9:16'])).toBe('16:9')
    expect(pickDefaultAspectRatio(['1:1', '4:3'])).toBe('1:1')
  })
})

describe('decodeOpenRouterImageResponse', () => {
  it('decodes multiple b64 images', () => {
    const png1 = Buffer.from([1, 2, 3]).toString('base64')
    const png2 = Buffer.from([4, 5, 6]).toString('base64')
    const decoded = decodeOpenRouterImageResponse({
      data: [
        { b64_json: png1, media_type: 'image/png' },
        { b64_json: png2, mime_type: 'image/jpeg' }
      ],
      usage: { cost: 0.012 }
    })
    expect(decoded.images).toHaveLength(2)
    expect(decoded.images[0]!.data.equals(Buffer.from([1, 2, 3]))).toBe(true)
    expect(decoded.images[1]!.mime).toBe('image/jpeg')
    expect(decoded.costUsd).toBe(0.012)
  })

  it('accepts data URL and remote URL rows', () => {
    const b64 = Buffer.from('hi').toString('base64')
    const decoded = decodeOpenRouterImageResponse({
      data: [
        `data:image/png;base64,${b64}`,
        { url: 'https://example.com/a.png' }
      ]
    })
    expect(decoded.images).toHaveLength(2)
    expect(decoded.images[0]!.data.toString()).toBe('hi')
    expect(decoded.images[1]!.sourceUrl).toBe('https://example.com/a.png')
  })
})
