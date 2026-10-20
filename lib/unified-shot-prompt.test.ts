import { describe, expect, it } from 'vitest'
import { resolveShotVideoGenerationPrompt } from './unified-shot-prompt'
import type { CreativeShot } from '~/types/creative-shot'

function shot (partial: Partial<CreativeShot>): CreativeShot {
  return {
    id: 's1',
    sceneId: 'sc1',
    projectId: 'p1',
    sortOrder: 0,
    title: partial.title || 'Shot',
    description: partial.description || '',
    shotType: partial.shotType || 'ECU',
    cameraMove: partial.cameraMove || 'Hold',
    durationSeconds: 5,
    imagePrompt: partial.imagePrompt || '',
    videoPrompt: partial.videoPrompt || '',
    negativePrompt: ''
  }
}

describe('resolveShotVideoGenerationPrompt', () => {
  it('uses the shot beat instead of the storyboard still prompt', () => {
    const still = [
      '=== PRIMARY ACTION — THIS PANEL ONLY (must dominate the image) ===',
      '"A — Screen CU: shaky tank feed" · ECU · camera: Hold',
      'Extreme close-up of the video wall.',
      'ONE IMAGE ONLY: a single cinematic storyboard still for this panel.',
      'DIRECTOR BIBLE (mandatory — apply to every frame):',
      'Director: Dusty Construction Chaos',
      'Lighting: The scenes are primarily lit by a hazy sun and practical trailer lamps that continue for a very long time.'
    ].join('\n')

    const out = resolveShotVideoGenerationPrompt(
      shot({
        title: 'A — Screen CU: shaky tank feed',
        description: 'Extreme close-up of the video wall. Shaky handheld Abrams feed on the construction site. Starts after the high-tech overlays are already gone.',
        imagePrompt: still,
        videoPrompt: still
      }),
      { cast: [] }
    )

    expect(out).toContain('VIDEO MOTION')
    expect(out).toContain('Shaky handheld Abrams feed')
    expect(out).toContain('start and end frames')
    expect(out).not.toContain('PRIMARY ACTION')
    expect(out).not.toContain('ONE IMAGE ONLY')
    expect(out).not.toContain('DIRECTOR BIBLE')
  })
})
