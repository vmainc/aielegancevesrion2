import { describe, expect, it } from 'vitest'
import {
  parseVideoGenerationDurationSeconds,
  videoToolDurationOptions
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

  it('omits 15 when only Seedance 1.5 Pro is selected', () => {
    expect(
      videoToolDurationOptions([{ supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12] }])
    ).toEqual([5, 10])
  })
})

describe('parseVideoGenerationDurationSeconds', () => {
  it('accepts 15', () => {
    expect(parseVideoGenerationDurationSeconds(15)).toBe(15)
    expect(parseVideoGenerationDurationSeconds('15')).toBe(15)
    expect(parseVideoGenerationDurationSeconds(12)).toBeUndefined()
  })
})
