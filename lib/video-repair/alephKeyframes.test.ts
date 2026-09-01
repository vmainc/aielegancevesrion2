import { describe, expect, it } from 'vitest'
import { alephKeyframePinSeconds, buildAlephKeyframeEntries } from './alephKeyframes'

describe('alephKeyframePinSeconds', () => {
  it('defaults to start only when duration is unknown or untrusted', () => {
    expect(alephKeyframePinSeconds()).toEqual([0])
    expect(alephKeyframePinSeconds(null)).toEqual([0])
    expect(alephKeyframePinSeconds(0)).toEqual([0])
    // Inflated client metadata must not invent mid/end pins.
    expect(alephKeyframePinSeconds(5)).toEqual([0])
    expect(alephKeyframePinSeconds(5, { durationTrusted: false })).toEqual([0])
  })

  it('pins start and end for short trusted clips', () => {
    expect(alephKeyframePinSeconds(1, { durationTrusted: true })).toEqual([0, 0.99])
  })

  it('pins start, mid, and end for typical trusted clips', () => {
    expect(alephKeyframePinSeconds(3, { durationTrusted: true })).toEqual([0, 1.5, 2.99])
    expect(alephKeyframePinSeconds(5, { durationTrusted: true })).toEqual([0, 2.5, 4.99])
    expect(alephKeyframePinSeconds(8, { durationTrusted: true })).toEqual([0, 4, 7.99])
  })
})

describe('buildAlephKeyframeEntries', () => {
  it('returns empty for non-https uris', () => {
    expect(buildAlephKeyframeEntries('data:image/png;base64,abc', 5, { durationTrusted: true })).toEqual(
      []
    )
    expect(buildAlephKeyframeEntries('http://example.com/a.jpg', 5, { durationTrusted: true })).toEqual(
      []
    )
  })

  it('reuses one uri at each pin when duration is trusted', () => {
    const uri = 'https://example.com/ref.jpg'
    expect(buildAlephKeyframeEntries(uri, 3, { durationTrusted: true })).toEqual([
      { uri, seconds: 0 },
      { uri, seconds: 1.5 },
      { uri, seconds: 2.99 }
    ])
  })

  it('pins start only when duration is not trusted', () => {
    const uri = 'https://example.com/ref.jpg'
    expect(buildAlephKeyframeEntries(uri, 5)).toEqual([{ uri, seconds: 0 }])
  })
})
