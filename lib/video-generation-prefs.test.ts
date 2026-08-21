import { describe, expect, it } from 'vitest'
import {
  parseVideoGenerationDurationSeconds,
  parseVideoGenerationResolution,
  snapVideoResolutionToModel,
  videoToolDurationOptions,
  videoToolResolutionOptions
} from '~/lib/video-generation-prefs'

describe('videoToolDurationOptions', () => {
  it('defaults to 5/10/15 when models lack duration metadata', () => {
    expect(videoToolDurationOptions([])).toEqual([5, 10, 15])
    expect(videoToolDurationOptions([{ supportedDurations: undefined }])).toEqual([5, 10, 15])
  })

  it('includes 15 when Seedance 2.0 is selected', () => {
    expect(
      videoToolDurationOptions([
        { supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }
      ])
    ).toEqual([5, 10, 15])
  })

  it('includes 30 when Seedance 2.5 is selected', () => {
    expect(
      videoToolDurationOptions([
        { supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 30] }
      ])
    ).toEqual([5, 10, 15, 30])
  })

  it('omits 15 when only Seedance 1.5 Pro is selected', () => {
    expect(
      videoToolDurationOptions([{ supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12] }])
    ).toEqual([5, 10])
  })
})

describe('parseVideoGenerationDurationSeconds', () => {
  it('accepts 15 and 30', () => {
    expect(parseVideoGenerationDurationSeconds(15)).toBe(15)
    expect(parseVideoGenerationDurationSeconds('15')).toBe(15)
    expect(parseVideoGenerationDurationSeconds(30)).toBe(30)
    expect(parseVideoGenerationDurationSeconds(12)).toBeUndefined()
  })
})

describe('parseVideoGenerationResolution', () => {
  it('accepts 720p and 1080p', () => {
    expect(parseVideoGenerationResolution('720p')).toBe('720p')
    expect(parseVideoGenerationResolution('1080p')).toBe('1080p')
    expect(parseVideoGenerationResolution('480p')).toBeUndefined()
  })
})

describe('videoToolResolutionOptions', () => {
  it('defaults to 720p and 1080p when models lack resolution metadata', () => {
    expect(videoToolResolutionOptions([])).toEqual(['720p', '1080p'])
    expect(videoToolResolutionOptions([{ supportedResolutions: undefined }])).toEqual(['720p', '1080p'])
  })

  it('hides 1080p when no selected model lists it', () => {
    expect(
      videoToolResolutionOptions([{ supportedResolutions: ['720p', '480p'] }])
    ).toEqual(['720p'])
  })

  it('includes 1080p for Atlas Seedance 2.5 catalog', () => {
    expect(
      videoToolResolutionOptions([{ supportedResolutions: ['720p', '1080p'] }])
    ).toEqual(['720p', '1080p'])
  })

  it('shows 1080p when any selected model lists it', () => {
    expect(
      videoToolResolutionOptions([
        { supportedResolutions: ['720p'] },
        { supportedResolutions: ['720p', '1080p'] }
      ])
    ).toEqual(['720p', '1080p'])
  })
})

describe('snapVideoResolutionToModel', () => {
  it('keeps 1080p when the model lists it', () => {
    expect(snapVideoResolutionToModel('1080p', ['720p', '1080p'])).toBe('1080p')
  })

  it('snaps 1080p down to 720p when the model does not list it', () => {
    expect(snapVideoResolutionToModel('1080p', ['720p'])).toBe('720p')
  })

  it('keeps the request when catalog is unknown', () => {
    expect(snapVideoResolutionToModel('1080p', undefined)).toBe('1080p')
    expect(snapVideoResolutionToModel('1080p', [])).toBe('1080p')
  })
})
