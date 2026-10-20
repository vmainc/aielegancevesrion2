import { describe, expect, it } from 'vitest'
import {
  buildVideoRegenerationMetadata,
  isDurableVideoFrameUrl,
  resolveVideoAssetPrompt,
  stripPlaybackAccessToken,
  videoAssetToGenerationPrefill
} from '~/lib/video-asset-regeneration'
import type { ProjectAsset } from '~/types/project-asset'

function asset (partial: Partial<ProjectAsset> & { id: string }): ProjectAsset {
  return {
    projectId: 'projxxxxxxxxxxxxxxx',
    kind: 'video',
    title: '',
    notes: '',
    metadata: null,
    sortOrder: 0,
    fileUrl: null,
    created: '',
    updated: '',
    ...partial
  }
}

describe('video-asset-regeneration', () => {
  it('prefers regeneration_prompt over generic notes', () => {
    const a = asset({
      id: 'assetxxxxxxxxxxxxxxx',
      title: 'Short title — video',
      notes: 'Generated from Video tools (standalone).',
      metadata: { regeneration_prompt: 'Full Vandermuth walks the bunker hallway, clean-shaven.' }
    })
    expect(resolveVideoAssetPrompt(a)).toEqual({
      prompt: 'Full Vandermuth walks the bunker hallway, clean-shaven.',
      truncated: false
    })
  })

  it('falls back to truncated title for older clips', () => {
    const a = asset({
      id: 'assetxxxxxxxxxxxxxxx',
      title: `${'Two characters named Moonbeam and Macklin walk together down a sunny sidewalk'.slice(0, 80)} — video`,
      notes: 'Generated from Video tools (standalone).'
    })
    const resolved = resolveVideoAssetPrompt(a)
    expect(resolved.prompt).toContain('Moonbeam')
    expect(resolved.truncated).toBe(true)
  })

  it('builds edit prefill with replaceAssetId', () => {
    const a = asset({
      id: 'clipxxxxxxxxxxxxxxx1',
      title: 'Bunker — video',
      notes: 'Vandermuth enters the bunker.',
      metadata: {
        regeneration_prompt: 'Vandermuth enters the bunker.',
        character_ids: ['charxxxxxxxxxxxxxxx'],
        aspect_ratio: '16:9',
        duration_seconds: 8,
        start_frame_url: '/api/projects/projxxxxxxxxxxxxxxx/assets/frmxxxxxxxxxxxxxxx/media',
        negative_prompt: 'no beard'
      }
    })
    const prefill = videoAssetToGenerationPrefill(a, 'projxxxxxxxxxxxxxxx')
    expect(prefill.replaceAssetId).toBe('clipxxxxxxxxxxxxxxx1')
    expect(prefill.source).toBe('project_generated_videos_edit')
    expect(prefill.prompt).toBe('Vandermuth enters the bunker.')
    expect(prefill.characterIds).toEqual(['charxxxxxxxxxxxxxxx'])
    expect(prefill.negativePrompt).toBe('no beard')
    expect(prefill.startFrameUrl).toContain('/media')
  })

  it('strips access tokens and rejects ephemeral frame urls', () => {
    expect(stripPlaybackAccessToken('/api/projects/x/assets/y/media?access_token=abc')).toBe(
      '/api/projects/x/assets/y/media'
    )
    expect(isDurableVideoFrameUrl('data:image/png;base64,xx')).toBe(false)
    expect(isDurableVideoFrameUrl('/api/generate/video/start-frame/abcdef0123456789abcdef0123456789')).toBe(false)
    expect(isDurableVideoFrameUrl('/api/projects/a/assets/b/media')).toBe(true)
  })

  it('buildVideoRegenerationMetadata stores prompt for later edit', () => {
    const meta = buildVideoRegenerationMetadata({
      userPrompt: 'Clean-shaven general walks forward.',
      characterIds: ['charxxxxxxxxxxxxxxx'],
      startFrameUrl: '/api/projects/p/assets/f/media?access_token=tok',
      aspectRatio: '16:9',
      durationSeconds: 8,
      modelId: 'bytedance/seedance-1-5-pro'
    })
    expect(meta.regeneration_prompt).toBe('Clean-shaven general walks forward.')
    expect(meta.start_frame_url).toBe('/api/projects/p/assets/f/media')
    expect(meta.character_ids).toEqual(['charxxxxxxxxxxxxxxx'])
  })
})
