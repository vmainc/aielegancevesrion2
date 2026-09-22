import { describe, expect, it } from 'vitest'
import {
  appendPlaybackAccessToken,
  isGeneratedImageMediaPath,
  isProjectAssetMediaPath,
  isRepairVideoResultPath
} from '~/lib/project-asset-playback-url'

describe('appendPlaybackAccessToken', () => {
  it('appends access_token for generated image media paths', () => {
    const url = '/api/generate/images/media/abcdef0123456789abcdef0123456789/0'
    expect(isGeneratedImageMediaPath(url)).toBe(true)
    expect(appendPlaybackAccessToken(url, 'tok')).toBe(`${url}?access_token=tok`)
  })

  it('still appends for project asset and repair paths', () => {
    const asset = '/api/projects/p1/assets/a1/media'
    const repair = '/api/repair/video/result/rid'
    expect(isProjectAssetMediaPath(asset)).toBe(true)
    expect(isRepairVideoResultPath(repair)).toBe(true)
    expect(appendPlaybackAccessToken(asset, 't')).toContain('access_token=t')
    expect(appendPlaybackAccessToken(repair, 't')).toContain('access_token=t')
  })

  it('leaves unrelated urls unchanged', () => {
    expect(appendPlaybackAccessToken('https://cdn.example/x.png', 't')).toBe(
      'https://cdn.example/x.png'
    )
  })
})
