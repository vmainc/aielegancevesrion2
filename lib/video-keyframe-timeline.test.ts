import { describe, expect, it } from 'vitest'
import {
  addTimelineKeyframe,
  appendKeyframeTimelineGuidance,
  createDefaultTimelineKeyframes,
  deriveStartEndFromTimeline,
  middleTimelineKeyframeUrls,
  rescaleTimelineKeyframes,
  seedTimelineFromStartEnd
} from './video-keyframe-timeline'

describe('video keyframe timeline', () => {
  it('defaults to start and end slots', () => {
    const frames = createDefaultTimelineKeyframes(30)
    expect(frames).toHaveLength(2)
    expect(frames[0].atSeconds).toBe(0)
    expect(frames[1].atSeconds).toBe(30)
  })

  it('derives start/end from the 0s and end slots, not mid images', () => {
    const frames = seedTimelineFromStartEnd({
      durationSeconds: 10,
      startFrameUrl: 'https://a/start.jpg',
      endFrameUrl: 'https://a/end.jpg'
    })
    frames.splice(1, 0, {
      id: 'mid',
      atSeconds: 5,
      imageUrl: 'https://a/mid.jpg',
      note: 'turn'
    })
    const derived = deriveStartEndFromTimeline(frames)
    expect(derived.startFrameUrl).toBe('https://a/start.jpg')
    expect(derived.endFrameUrl).toBe('https://a/end.jpg')
    expect(middleTimelineKeyframeUrls(frames)).toEqual(['https://a/mid.jpg'])
  })

  it('does not treat an end-only still as the start frame', () => {
    const frames = seedTimelineFromStartEnd({
      durationSeconds: 10,
      startFrameUrl: null,
      endFrameUrl: 'https://a/end.jpg'
    })
    const derived = deriveStartEndFromTimeline(frames)
    expect(derived.startFrameUrl).toBeNull()
    expect(derived.endFrameUrl).toBe('https://a/end.jpg')
  })

  it('appends ordered beat guidance once', () => {
    const frames = [
      { id: 'a', atSeconds: 0, imageUrl: 'https://a/s.jpg', note: 'wide establish' },
      { id: 'b', atSeconds: 8, imageUrl: null, note: 'push in on eyes' },
      { id: 'c', atSeconds: 16, imageUrl: 'https://a/e.jpg', note: '' }
    ]
    const once = appendKeyframeTimelineGuidance('Locked tracking shot.', frames, 16)
    expect(once).toContain('SHOT TIMELINE')
    expect(once).toContain('Start · 0s')
    expect(once).toContain('hold the start-frame still')
    expect(once).toContain('wide establish')
    expect(once).toContain('8s')
    expect(once).toContain('push in on eyes')
    expect(once).not.toContain('match the attached still')
    expect(once.indexOf('Start · 0s')).toBeLessThan(once.indexOf('8s'))
    const twice = appendKeyframeTimelineGuidance(once, frames, 16)
    expect(twice.match(/SHOT TIMELINE/g)?.length).toBe(1)
  })

  it('treats mid beats as text cues even if an imageUrl is present', () => {
    const frames = [
      { id: 'a', atSeconds: 0, imageUrl: 'https://a/s.jpg', note: '' },
      { id: 'b', atSeconds: 5, imageUrl: 'https://a/mid.jpg', note: 'turns toward door' },
      { id: 'c', atSeconds: 10, imageUrl: 'https://a/e.jpg', note: '' }
    ]
    const out = appendKeyframeTimelineGuidance('Wide shot.', frames, 10)
    expect(out).toContain('turns toward door')
    expect(out).not.toMatch(/5s:.*match the attached still/)
    expect(out).toContain('hold the start-frame still')
    expect(out).toContain('land on the end-frame still')
  })

  it('adds a beat in the largest gap and rescales with duration', () => {
    let frames = createDefaultTimelineKeyframes(20)
    frames = addTimelineKeyframe(frames, 20)
    expect(frames).toHaveLength(3)
    expect(frames[1].atSeconds).toBe(10)
    frames = rescaleTimelineKeyframes(frames, 20, 40)
    expect(frames[0].atSeconds).toBe(0)
    expect(frames[1].atSeconds).toBe(20)
    expect(frames[2].atSeconds).toBe(40)
  })
})
