import { describe, expect, it } from 'vitest'
import { alephKeyframePinSeconds, buildAlephKeyframeEntries } from './alephKeyframes'

describe('alephKeyframePinSeconds', () => {
  it('defaults to start only when duration is unknown', () => {
    expect(alephKeyframePinSeconds()).toEqual([0])
    expect(alephKeyframePinSeconds(null)).toEqual([0])
    expect(alephKeyframePinSeconds(0)).toEqual([0])
  })

  it('pins start and end for short clips', () => {
    expect(alephKeyframePinSeconds(1)).toEqual([0, 1])
  })

  it('pins start, mid, and end for typical clips', () => {
    expect(alephKeyframePinSeconds(5)).toEqual([0, 2.5, 4.95])
    expect(alephKeyframePinSeconds(8)).toEqual([0, 4, 7.95])
  })
})

describe('buildAlephKeyframeEntries', () => {
  it('returns empty for non-https uris', () => {
    expect(buildAlephKeyframeEntries('data:image/png;base64,abc', 5)).toEqual([])
    expect(buildAlephKeyframeEntries('http://example.com/a.jpg', 5)).toEqual([])
  })

  it('reuses one uri at each pin', () => {
    const uri = 'https://example.com/ref.jpg'
    expect(buildAlephKeyframeEntries(uri, 5)).toEqual([
      { uri, seconds: 0 },
      { uri, seconds: 2.5 },
      { uri, seconds: 4.95 }
    ])
  })
})
