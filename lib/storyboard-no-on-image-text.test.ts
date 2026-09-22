import { describe, expect, it } from 'vitest'
import {
  SINGLE_STORYBOARD_FRAME_DIRECTIVE,
  STORYBOARD_NO_ON_IMAGE_TEXT_DIRECTIVE
} from '~/lib/storyboard-frame-image'
import { STANDARD_STORYBOARD_NEGATIVES } from '~/lib/storyboard-continuity-prompts'

describe('storyboard no on-image text', () => {
  it('bakes the ban into the single-frame directive', () => {
    expect(SINGLE_STORYBOARD_FRAME_DIRECTIVE).toContain('NO ON-IMAGE TEXT')
    expect(SINGLE_STORYBOARD_FRAME_DIRECTIVE).toContain(STORYBOARD_NO_ON_IMAGE_TEXT_DIRECTIVE)
    expect(SINGLE_STORYBOARD_FRAME_DIRECTIVE).toMatch(/speech bubbles/i)
  })

  it('includes comic lettering exclusions in standard negatives', () => {
    expect(STANDARD_STORYBOARD_NEGATIVES).toMatch(/speech bubble/i)
    expect(STANDARD_STORYBOARD_NEGATIVES).toMatch(/comic caption/i)
    expect(STANDARD_STORYBOARD_NEGATIVES).toMatch(/readable text/i)
  })
})
