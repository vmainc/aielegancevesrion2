import { describe, expect, it } from 'vitest'
import {
  applyStoryboardFrameRoleToPrompt,
  buildStoryboardEndFramePrompt,
  describeShotClipPurpose,
  shotMissingStoryboardFrame
} from './storyboard-end-frame-prompt'

const leapShot = {
  title: "DOG's Energetic Leap",
  description: 'DOG begins the leap over CAT in the living room.',
  videoPrompt: 'DOG jumps; CAT stays put; camera holds medium.',
  cameraMove: 'subtle push-in',
  shotType: 'medium'
}

describe('describeShotClipPurpose', () => {
  it('combines title, shot type, camera, and beat', () => {
    const purpose = describeShotClipPurpose(leapShot)
    expect(purpose).toContain("DOG's Energetic Leap")
    expect(purpose).toContain('medium')
    expect(purpose).toContain('subtle push-in')
    expect(purpose).toContain('leap over CAT')
  })
})

describe('buildStoryboardEndFramePrompt', () => {
  it('appends concluding-frame rules and clip purpose', () => {
    const out = buildStoryboardEndFramePrompt(
      '=== PRIMARY ACTION ===\nDOG mid-leap over CAT',
      leapShot
    )
    expect(out).toContain('PRIMARY ACTION')
    expect(out).toContain('=== END FRAME')
    expect(out).toMatch(/LAST frame/i)
    expect(out).toContain('landing after a leap')
    expect(out).toContain("DOG's Energetic Leap")
  })

  it('does not double-append end frame blocks', () => {
    const once = buildStoryboardEndFramePrompt('base still', leapShot)
    const twice = buildStoryboardEndFramePrompt(once, leapShot)
    expect(twice.match(/=== END FRAME/gi)?.length).toBe(1)
  })
})

describe('applyStoryboardFrameRoleToPrompt', () => {
  it('leaves start prompts unchanged', () => {
    expect(applyStoryboardFrameRoleToPrompt('hello', 'start', leapShot)).toBe('hello')
  })

  it('wraps end prompts with purpose', () => {
    const out = applyStoryboardFrameRoleToPrompt('hello', 'end', leapShot)
    expect(out).toContain('hello')
    expect(out).toContain('END FRAME')
  })
})

describe('shotMissingStoryboardFrame', () => {
  it('is true unless both start and end exist', () => {
    expect(shotMissingStoryboardFrame(false, false)).toBe(true)
    expect(shotMissingStoryboardFrame(true, false)).toBe(true)
    expect(shotMissingStoryboardFrame(false, true)).toBe(true)
    expect(shotMissingStoryboardFrame(true, true)).toBe(false)
  })
})
