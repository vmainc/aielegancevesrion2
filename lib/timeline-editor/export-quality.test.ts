import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIMELINE_EXPORT_QUALITY,
  parseTimelineExportQuality,
  timelineExportQualityPreset
} from '~/lib/timeline-editor/export-quality'

describe('parseTimelineExportQuality', () => {
  it('accepts 720p and 1080p', () => {
    expect(parseTimelineExportQuality('720p')).toBe('720p')
    expect(parseTimelineExportQuality('1080p')).toBe('1080p')
  })

  it('migrates leftover 480p to 720p', () => {
    expect(parseTimelineExportQuality('480p')).toBe('720p')
  })

  it('rejects unknown values', () => {
    expect(parseTimelineExportQuality('4k')).toBeUndefined()
    expect(parseTimelineExportQuality('')).toBeUndefined()
    expect(parseTimelineExportQuality(720)).toBeUndefined()
  })
})

describe('timelineExportQualityPreset', () => {
  it('defaults to 720p', () => {
    expect(timelineExportQualityPreset(undefined).id).toBe(DEFAULT_TIMELINE_EXPORT_QUALITY)
    expect(timelineExportQualityPreset(null).width).toBe(1280)
    expect(timelineExportQualityPreset(null).height).toBe(720)
  })

  it('scales bitrate with resolution', () => {
    const standard = timelineExportQualityPreset('720p')
    const high = timelineExportQualityPreset('1080p')
    expect(standard.width).toBe(1280)
    expect(high.width).toBe(1920)
    expect(high.height).toBe(1080)
    expect(high.videoBitsPerSecond).toBeGreaterThan(standard.videoBitsPerSecond)
  })
})
