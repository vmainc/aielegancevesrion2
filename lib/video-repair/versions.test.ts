import { describe, expect, it } from 'vitest'
import type { ProjectAsset } from '~/types/project-asset'
import {
  listShotVideoVersions,
  nextShotVideoVersionNumber,
  VIDEO_REPAIR_ASSET_SOURCE
} from './versions'

function asset (partial: Partial<ProjectAsset> & { id: string }): ProjectAsset {
  return {
    projectId: 'proj',
    kind: 'video',
    title: 'clip',
    notes: '',
    metadata: null,
    sortOrder: 0,
    fileUrl: '/x.mp4',
    created: '2026-01-01 00:00:00',
    updated: '2026-01-01 00:00:00',
    ...partial
  }
}

describe('shot video versions', () => {
  it('numbers repairs after the original and never treats repair as v1', () => {
    const original = asset({
      id: 'a1',
      shotId: 'shot1',
      metadata: { shot_id: 'shot1', source: 'video_generation', is_current: true }
    })
    const repair = asset({
      id: 'a2',
      shotId: 'shot1',
      created: '2026-01-02 00:00:00',
      metadata: {
        shot_id: 'shot1',
        source: VIDEO_REPAIR_ASSET_SOURCE,
        version: 2,
        version_label: 'Face / Eyes',
        parent_asset_id: 'a1',
        original_asset_id: 'a1'
      }
    })
    const versions = listShotVideoVersions([original, repair], 'shot1')
    expect(versions.map(v => `${v.version}:${v.label}:${v.kind}`)).toEqual([
      '1:Original:original',
      '2:Face / Eyes:repair'
    ])
    expect(nextShotVideoVersionNumber([original, repair], 'shot1')).toBe(3)
  })
})
